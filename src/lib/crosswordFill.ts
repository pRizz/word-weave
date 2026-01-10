type Coord = Readonly<{ r: number; c: number }>;
type Dir = "across" | "down";

type Slot = Readonly<{
  id: string;
  dir: Dir;
  cells: ReadonlyArray<Coord>;
  length: number;
}>;

type FillResult = Readonly<{
  grid: string[][];
  assignments: Map<string, string>;
}>;

export type CrosswordFillOptions = Readonly<{
  minWordLength?: number;
  allowReuseWords?: boolean;
  randomizeCandidates?: boolean;
  maxSteps?: number;
}>;

export function fillCrossword(
  shape: boolean[][],
  dictionary: ReadonlyArray<string>,
  options: CrosswordFillOptions = {},
): FillResult | null {
  const minWordLength = options.minWordLength ?? 2;
  const allowReuseWords = options.allowReuseWords ?? false;
  const randomizeCandidates = options.randomizeCandidates ?? true;
  const maxSteps = options.maxSteps ?? 2_000_000;

  const normalized = normalizeDictionary(dictionary);
  const dictByLen = indexByLength(normalized);

  const height = shape.length;
  if (height === 0) return null;
  const width = shape[0]?.length ?? 0;

  if (!isRect(shape)) return null;

  const slots = extractSlots(shape, minWordLength);
  if (slots.length === 0) return null;

  const grid = makeEmptyGrid(shape);
  const assignments = new Map<string, string>();
  const usedWords = new Set<string>();

  let steps = 0;

  const result = backtrack();
  return result;

  function backtrack(): FillResult | null {
    steps++;
    if (steps > maxSteps) return null;

    if (assignments.size === slots.length) {
      return { grid: cloneGrid(grid), assignments: new Map(assignments) };
    }

    const next = pickNextSlot(slots, assignments, grid, dictByLen, usedWords, allowReuseWords);
    if (!next) return null;

    const { slot, candidates } = next;
    const ordered = randomizeCandidates ? shuffled(candidates) : candidates;

    for (const word of ordered) {
      if (!allowReuseWords && usedWords.has(word)) continue;

      const placed = tryPlaceWord(grid, slot, word);
      if (!placed) continue;

      assignments.set(slot.id, word);
      usedWords.add(word);

      const solved = backtrack();
      if (solved) return solved;

      assignments.delete(slot.id);
      if (!allowReuseWords) usedWords.delete(word);
      undoPlacement(grid, placed);
    }

    return null;
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

function undoPlacement(grid: string[][], changes: ReadonlyArray<{ r: number; c: number; prev: string }>): void {
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
    const filtered = allowReuseWords ? candidates : candidates.filter(w => !usedWords.has(w));

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

  return words.filter(w => matchesConstraints(w, constraints));
}

function matchesConstraints(word: string, constraints: ReadonlyArray<string>): boolean {
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
        const cells = range(runLen).map(i => ({ r, c: start + i }));
        slots.push({ id: `A:${r}:${start}`, dir: "across", cells, length: runLen });
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
        const cells = range(runLen).map(i => ({ r: start + i, c }));
        slots.push({ id: `D:${start}:${c}`, dir: "down", cells, length: runLen });
      }
      r++;
    }
  }

  return slots;
}

function makeEmptyGrid(shape: boolean[][]): string[][] {
  return shape.map(row => row.map(cell => (cell ? "" : "#")));
}

function cloneGrid(grid: string[][]): string[][] {
  return grid.map(row => row.slice());
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

export function getClueNumbers(shape: boolean[][]): Map<string, number> {
  const clueNumbers = new Map<string, number>();
  let num = 1;
  const h = shape.length;
  const w = shape[0]?.length ?? 0;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!shape[r]![c]) continue;
      
      const isAcrossStart = (c === 0 || !shape[r]![c - 1]) && (c + 1 < w && shape[r]![c + 1]);
      const isDownStart = (r === 0 || !shape[r - 1]?.[c]) && (r + 1 < h && shape[r + 1]?.[c]);
      
      if (isAcrossStart || isDownStart) {
        clueNumbers.set(`${r}:${c}`, num);
        num++;
      }
    }
  }

  return clueNumbers;
}
