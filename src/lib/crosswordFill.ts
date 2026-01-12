export type CrosswordFillOptions = Readonly<{
  minWordLength?: number;
  allowReuseWords?: boolean;
  randomizeCandidates?: boolean;
  maxSteps?: number;
}>;

type Coord = Readonly<{ r: number; c: number }>;
type Dir = "across" | "down";

type Slot = Readonly<{
  id: string;
  dir: Dir;
  cells: ReadonlyArray<Coord>;
  length: number;
}>;

export type DictionaryIndex = Readonly<{
  normalizedWords: ReadonlyArray<string>;
  wordsByLength: ReadonlyMap<number, ReadonlyArray<string>>;
}>;

export function buildDictionaryIndex(
  dictionary: ReadonlyArray<string>,
): DictionaryIndex {
  const normalizedWords = normalizeDictionary(dictionary);
  const wordsByLength = indexByLength(normalizedWords);
  return { normalizedWords, wordsByLength };
}

export type FillCrosswordOutcome =
  | Readonly<{
      ok: true;
      grid: string[][];
      assignments: Map<string, string>;
      steps: number;
    }>
  | Readonly<{
      ok: false;
      reason: string;
      steps: number;
    }>;

export type FillCrosswordProgressCallback = (
  steps: number,
  partialGrid: string[][],
) => boolean;

export function fillCrossword(
  shape: boolean[][],
  dictionary: ReadonlyArray<string>,
  options: CrosswordFillOptions = {},
  onProgress?: FillCrosswordProgressCallback,
): FillCrosswordOutcome {
  const minWordLength = options.minWordLength ?? 2;
  const allowReuseWords = options.allowReuseWords ?? false;
  const randomizeCandidates = options.randomizeCandidates ?? true;
  const maxSteps = options.maxSteps ?? 2_000_000;
  const progressInterval = 100;

  const { wordsByLength } = buildDictionaryIndex(dictionary);

  const height = shape.length;
  if (height === 0) return { ok: false, reason: "Empty shape: height is 0", steps: 0 };

  if (!isRect(shape)) {
    return {
      ok: false,
      reason: "Non-rectangular shape: rows have different widths",
      steps: 0,
    };
  }

  const slots = extractSlots(shape, minWordLength);
  if (slots.length === 0) {
    return {
      ok: false,
      reason: `No valid slots found (min word length: ${minWordLength})`,
      steps: 0,
    };
  }

  const grid = makeEmptyGrid(shape);
  const assignments = new Map<string, string>();
  const usedWords = new Set<string>();

  let steps = 0;
  let maybeFailureReason: string | null = null;

  const solved = backtrack();
  if (solved) {
    return {
      ok: true,
      grid: cloneGrid(grid),
      assignments: new Map(assignments),
      steps,
    };
  }

  return {
    ok: false,
    reason:
      maybeFailureReason ??
      `Could not find a valid solution after ${steps.toLocaleString()} steps. The grid pattern may be too constrained.`,
    steps,
  };

  function backtrack(): boolean {
    steps++;
    if (steps > maxSteps) {
      maybeFailureReason = `Maximum steps exceeded: ${maxSteps.toLocaleString()} steps reached without finding a solution`;
      return false;
    }

    if (onProgress && steps % progressInterval === 0) {
      const shouldContinue = onProgress(steps, grid);
      if (!shouldContinue) {
        maybeFailureReason = "Generation was cancelled";
        return false;
      }
    }

    if (assignments.size === slots.length) {
      return true;
    }

    const next = pickNextSlot(
      slots,
      assignments,
      grid,
      wordsByLength,
      usedWords,
      allowReuseWords,
    );
    if (!next) return false;

    const { slot, candidates } = next;
    const ordered = randomizeCandidates ? shuffled(candidates) : candidates;

    for (const word of ordered) {
      if (!allowReuseWords && usedWords.has(word)) continue;

      const placed = tryPlaceWord(grid, slot, word);
      if (!placed) continue;

      assignments.set(slot.id, word);
      usedWords.add(word);

      const solvedInner = backtrack();
      if (solvedInner) return true;

      assignments.delete(slot.id);
      if (!allowReuseWords) usedWords.delete(word);
      undoPlacement(grid, placed);
    }

    return false;
  }
}

function tryPlaceWord(
  grid: string[][],
  slot: Slot,
  word: string,
): ReadonlyArray<Readonly<{ r: number; c: number; prev: string }>> | null {
  if (word.length !== slot.length) return null;

  const changes: Array<{ r: number; c: number; prev: string }> = [];

  for (let i = 0; i < slot.cells.length; i++) {
    const { r, c } = slot.cells[i]!;
    const existing = grid[r]![c]!;
    const ch = word[i]!;
    if (existing !== "" && existing !== ch) {
      return null;
    }
    if (existing === "") {
      changes.push({ r, c, prev: existing });
      grid[r]![c] = ch;
    }
  }

  return changes;
}

function undoPlacement(
  grid: string[][],
  changes: ReadonlyArray<{ r: number; c: number; prev: string }>,
): void {
  for (const { r, c, prev } of changes) {
    grid[r]![c] = prev;
  }
}

function pickNextSlot(
  slots: ReadonlyArray<Slot>,
  assignments: ReadonlyMap<string, string>,
  grid: string[][],
  dictByLen: ReadonlyMap<number, ReadonlyArray<string>>,
  usedWords: ReadonlySet<string>,
  allowReuseWords: boolean,
): { slot: Slot; candidates: string[] } | null {
  let bestSlot: Slot | null = null;
  let bestCandidates: string[] | null = null;

  for (const slot of slots) {
    if (assignments.has(slot.id)) continue;

    const candidates = getCandidatesForSlot(slot, grid, dictByLen);
    if (candidates.length === 0) return null;
    const filtered = allowReuseWords
      ? candidates
      : candidates.filter((w) => !usedWords.has(w));

    if (filtered.length === 0) return null;

    if (!bestSlot) {
      bestSlot = slot;
      bestCandidates = filtered;
      continue;
    }

    if (filtered.length < (bestCandidates?.length ?? Infinity)) {
      bestSlot = slot;
      bestCandidates = filtered;
    }
  }

  if (!bestSlot || !bestCandidates) return null;
  return { slot: bestSlot, candidates: bestCandidates };
}

function getCandidatesForSlot(
  slot: Slot,
  grid: string[][],
  dictByLen: ReadonlyMap<number, ReadonlyArray<string>>,
): string[] {
  const words = dictByLen.get(slot.length) ?? [];
  const constraints = slot.cells.map(({ r, c }) => grid[r]![c]!);

  return words.filter((w) => matchesConstraints(w, constraints));
}

function matchesConstraints(
  word: string,
  constraints: ReadonlyArray<string>,
): boolean {
  for (let i = 0; i < constraints.length; i++) {
    const want = constraints[i]!;
    if (want === "") continue;
    if (word[i] !== want) return false;
  }
  return true;
}

function extractSlots(shape: boolean[][], minLen: number): Slot[] {
  const slots: Slot[] = [];
  const h = shape.length;
  const w = shape[0]!.length;

  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      const start = c;
      while (c < w && shape[r]![c]!) c++;
      const runLen = c - start;
      if (runLen >= minLen) {
        const cells = range(runLen).map((i) => ({ r, c: start + i }));
        slots.push({
          id: `A:${r}:${start}`,
          dir: "across",
          cells,
          length: runLen,
        });
      }
      c++;
    }
  }

  for (let c = 0; c < w; c++) {
    let r = 0;
    while (r < h) {
      const start = r;
      while (r < h && shape[r]![c]!) r++;
      const runLen = r - start;
      if (runLen >= minLen) {
        const cells = range(runLen).map((i) => ({ r: start + i, c }));
        slots.push({
          id: `D:${start}:${c}`,
          dir: "down",
          cells,
          length: runLen,
        });
      }
      r++;
    }
  }

  return slots;
}

function makeEmptyGrid(shape: boolean[][]): string[][] {
  return shape.map((row) => row.map((cell) => (cell ? "" : "#")));
}

function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => row.slice());
}

function normalizeDictionary(words: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  for (const w of words) {
    const up = w.trim().toUpperCase();
    if (up.length === 0) continue;
    if (!/^[A-Z]+$/.test(up)) continue;
    out.push(up);
  }
  return out;
}

function indexByLength(words: ReadonlyArray<string>): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const w of words) {
    const arr = m.get(w.length);
    if (arr) arr.push(w);
    else m.set(w.length, [w]);
  }
  return m;
}

function isRect(grid: ReadonlyArray<ReadonlyArray<unknown>>): boolean {
  const h = grid.length;
  if (h === 0) return true;
  const w = grid[0]!.length;
  for (const row of grid) {
    if (row.length !== w) return false;
  }
  return true;
}

function range(n: number): number[] {
  const a = new Array<number>(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}

function shuffled<T>(arr: ReadonlyArray<T>): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export type CrosswordShapeIssueSeverity = "error" | "warning";
export type CrosswordShapeIssueCode =
  | "empty_shape"
  | "non_rectangular"
  | "no_slots"
  | "orphan_cells"
  | "no_candidates_for_slot_length"
  | "not_enough_unique_words_for_length"
  | "disconnected_components";

export type CrosswordShapeIssue = Readonly<{
  code: CrosswordShapeIssueCode;
  severity: CrosswordShapeIssueSeverity;
  message: string;
}>;

export type CrosswordShapeAnalysis = Readonly<{
  isValid: boolean;
  issues: ReadonlyArray<CrosswordShapeIssue>;
  slotCount: number;
}>;

export function analyzeCrosswordShape(params: Readonly<{
  shape: boolean[][];
  dictionaryIndex: DictionaryIndex;
  minWordLength: number;
  allowReuseWords: boolean;
}>): CrosswordShapeAnalysis {
  const { shape, dictionaryIndex, minWordLength, allowReuseWords } = params;

  const issues: CrosswordShapeIssue[] = [];

  const height = shape.length;
  if (height === 0) {
    issues.push({
      code: "empty_shape",
      severity: "error",
      message: "Grid is empty.",
    });
    return { isValid: false, issues, slotCount: 0 };
  }

  if (!isRect(shape)) {
    issues.push({
      code: "non_rectangular",
      severity: "error",
      message: "Grid rows are different widths (non-rectangular).",
    });
    return { isValid: false, issues, slotCount: 0 };
  }

  const slots = extractSlots(shape, minWordLength);
  if (slots.length === 0) {
    issues.push({
      code: "no_slots",
      severity: "error",
      message: `No across/down word slots of length ≥ ${minWordLength}. Add more consecutive white squares.`,
    });
  }

  const orphanCellCount = countOrphanCells(shape, slots);
  if (orphanCellCount > 0) {
    issues.push({
      code: "orphan_cells",
      severity: "error",
      message: `${orphanCellCount} white cell(s) are not part of any across/down slot of length ≥ ${minWordLength}. Remove isolated singletons or extend them into real words.`,
    });
  }

  const slotCountsByLength = countSlotsByLength(slots);
  const noCandidateLengths: Array<{ length: number; slotCount: number }> = [];
  const notEnoughWordsLengths: Array<{
    length: number;
    slotCount: number;
    wordCount: number;
  }> = [];

  for (const [length, slotCount] of slotCountsByLength) {
    const wordCount = dictionaryIndex.wordsByLength.get(length)?.length ?? 0;
    if (wordCount === 0) {
      noCandidateLengths.push({ length, slotCount });
      continue;
    }
    if (!allowReuseWords && wordCount < slotCount) {
      notEnoughWordsLengths.push({ length, slotCount, wordCount });
    }
  }

  if (noCandidateLengths.length > 0) {
    const details = noCandidateLengths
      .sort((a, b) => a.length - b.length)
      .map(
        ({ length, slotCount }) =>
          `${slotCount} slot(s) of length ${length} (0 words in dictionary)`,
      )
      .join("; ");
    issues.push({
      code: "no_candidates_for_slot_length",
      severity: "error",
      message: `Some slots have no candidates in the dictionary: ${details}.`,
    });
  }

  if (notEnoughWordsLengths.length > 0) {
    const details = notEnoughWordsLengths
      .sort((a, b) => a.length - b.length)
      .map(
        ({ length, slotCount, wordCount }) =>
          `${slotCount} slot(s) of length ${length} but only ${wordCount} unique word(s) available`,
      )
      .join("; ");
    issues.push({
      code: "not_enough_unique_words_for_length",
      severity: "error",
      message: `Reuse is disabled, but the dictionary doesn’t have enough unique words: ${details}.`,
    });
  }

  const componentCount = countConnectedComponents(shape);
  if (componentCount > 1) {
    issues.push({
      code: "disconnected_components",
      severity: "warning",
      message: `Your grid has ${componentCount} disconnected “islands” of white cells. This is allowed, but it often makes generation harder or creates odd puzzles.`,
    });
  }

  const isValid = issues.every((i) => i.severity !== "error");
  return { isValid, issues, slotCount: slots.length };
}

function countSlotsByLength(slots: ReadonlyArray<Slot>): Map<number, number> {
  const m = new Map<number, number>();
  for (const slot of slots) {
    m.set(slot.length, (m.get(slot.length) ?? 0) + 1);
  }
  return m;
}

function countOrphanCells(shape: boolean[][], slots: ReadonlyArray<Slot>): number {
  const covered = new Set<string>();
  for (const slot of slots) {
    for (const { r, c } of slot.cells) {
      covered.add(`${r}:${c}`);
    }
  }

  let orphanCount = 0;
  for (let r = 0; r < shape.length; r++) {
    const row = shape[r]!;
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      if (!covered.has(`${r}:${c}`)) orphanCount++;
    }
  }
  return orphanCount;
}

function countConnectedComponents(shape: boolean[][]): number {
  const h = shape.length;
  const w = shape[0]?.length ?? 0;

  const visited: boolean[][] = shape.map((row) => row.map(() => false));
  let components = 0;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!shape[r]![c]) continue;
      if (visited[r]![c]) continue;

      components++;
      const queue: Array<{ r: number; c: number }> = [{ r, c }];
      visited[r]![c] = true;

      while (queue.length > 0) {
        const cur = queue.pop()!;
        const neighbors = [
          { r: cur.r - 1, c: cur.c },
          { r: cur.r + 1, c: cur.c },
          { r: cur.r, c: cur.c - 1 },
          { r: cur.r, c: cur.c + 1 },
        ];
        for (const n of neighbors) {
          if (n.r < 0 || n.r >= h || n.c < 0 || n.c >= w) continue;
          if (!shape[n.r]![n.c]) continue;
          if (visited[n.r]![n.c]) continue;
          visited[n.r]![n.c] = true;
          queue.push(n);
        }
      }
    }
  }

  return components;
}

export function getClueNumbers(shape: boolean[][]): Map<string, number> {
  const clueNumbers = new Map<string, number>();
  let num = 1;
  const h = shape.length;
  const w = shape[0]?.length ?? 0;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!shape[r]![c]) continue;

      const isAcrossStart =
        (c === 0 || !shape[r]![c - 1]) && c + 1 < w && shape[r]![c + 1];
      const isDownStart =
        (r === 0 || !shape[r - 1]?.[c]) && r + 1 < h && shape[r + 1]?.[c];

      if (isAcrossStart || isDownStart) {
        clueNumbers.set(`${r}:${c}`, num);
        num++;
      }
    }
  }

  return clueNumbers;
}
