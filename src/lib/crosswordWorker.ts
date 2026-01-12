// Web Worker for crossword puzzle generation

type Coord = Readonly<{ r: number; c: number }>;
type Dir = "across" | "down";

type Slot = Readonly<{
  id: string;
  dir: Dir;
  cells: ReadonlyArray<Coord>;
  length: number;
}>;

export type CrosswordFillOptions = Readonly<{
  minWordLength?: number;
  allowReuseWords?: boolean;
  randomizeCandidates?: boolean;
  maxSteps?: number;
}>;

export type WorkerMessage =
  | {
      type: "start";
      shape: boolean[][];
      dictionary: string[];
      options: CrosswordFillOptions;
    }
  | { type: "cancel" };

export type WorkerResponse =
  | {
      type: "progress";
      steps: number;
      elapsedMs: number;
      partialGrid: string[][];
    }
  | {
      type: "complete";
      grid: string[][] | null;
      assignments: [string, string][] | null;
      elapsedMs: number;
      backtracks: number;
      errorReason?: string;
    }
  | { type: "error"; message: string };

let cancelled = false;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }

  if (msg.type === "start") {
    cancelled = false;
    const startTime = performance.now();
    let totalSteps = 0;

    try {
      const result = fillCrossword(
        msg.shape,
        msg.dictionary,
        msg.options,
        (steps, partialGrid) => {
          if (cancelled) return false;
          totalSteps = steps;

          const elapsedMs = performance.now() - startTime;
          self.postMessage({
            type: "progress",
            steps,
            elapsedMs,
            partialGrid: cloneGrid(partialGrid),
          } as WorkerResponse);
          return true; // continue
        },
      );

      if (cancelled) return;

      const finalElapsedMs = performance.now() - startTime;

      if (result && "grid" in result) {
        self.postMessage({
          type: "complete",
          grid: result.grid,
          assignments: Array.from(result.assignments.entries()),
          elapsedMs: finalElapsedMs,
          backtracks: result.steps,
        } as WorkerResponse);
      } else {
        // Determine the most specific error reason
        let errorReason =
          "Unknown error: generation failed without specific reason";
        if (result && "reason" in result) {
          errorReason = result.reason;
          // Check if this was a fatal error (invalid input, max steps, cancelled)
          // vs a backtracking failure (which is normal exploration)
          const isFatalError =
            errorReason.includes("Empty shape") ||
            errorReason.includes("Non-rectangular") ||
            errorReason.includes("No valid slots found") ||
            errorReason.includes("Maximum steps exceeded") ||
            errorReason.includes("Generation was cancelled");

          if (!isFatalError) {
            // This is a backtracking failure - provide a more user-friendly message
            errorReason = `Could not find a valid solution: exhausted all possibilities after ${totalSteps.toLocaleString()} steps. The grid pattern may be too constrained.`;
          }
        }
        console.error(`[Crossword Generation Failed] ${errorReason}`);
        self.postMessage({
          type: "complete",
          grid: null,
          assignments: null,
          elapsedMs: finalElapsedMs,
          backtracks: totalSteps,
          errorReason,
        } as WorkerResponse);
      }
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      } as WorkerResponse);
    }
  }
};

// ============= Crossword Fill Algorithm =============

type FillResult = Readonly<{
  grid: string[][];
  assignments: Map<string, string>;
  steps: number;
}>;

type FillResultWithReason = FillResult | { result: null; reason: string };

function fillCrossword(
  shape: boolean[][],
  dictionary: ReadonlyArray<string>,
  options: CrosswordFillOptions = {},
  onProgress?: (steps: number, partialGrid: string[][]) => boolean,
): FillResultWithReason {
  const minWordLength = options.minWordLength ?? 2;
  const allowReuseWords = options.allowReuseWords ?? false;
  const randomizeCandidates = options.randomizeCandidates ?? true;
  const maxSteps = options.maxSteps ?? 2_000_000;
  const progressInterval = 100;

  const normalized = normalizeDictionary(dictionary);
  const dictByLen = indexByLength(normalized);

  const height = shape.length;
  if (height === 0)
    return { result: null, reason: "Empty shape: grid height is 0" };
  const width = shape[0]?.length ?? 0;

  if (!isRect(shape)) {
    return {
      result: null,
      reason: "Non-rectangular shape: rows have different widths",
    };
  }

  const slots = extractSlots(shape, minWordLength);
  if (slots.length === 0) {
    return {
      result: null,
      reason: `No valid slots found: no word slots of length >= ${minWordLength}`,
    };
  }

  const grid = makeEmptyGrid(shape);
  const assignments = new Map<string, string>();
  const usedWords = new Set<string>();

  let steps = 0;

  const result = backtrack();
  return result;

  function backtrack(): FillResultWithReason {
    steps++;
    if (steps > maxSteps) {
      return {
        result: null,
        reason: `Maximum steps exceeded: ${maxSteps.toLocaleString()} steps reached without finding a solution`,
      };
    }

    // Report progress every N steps
    if (onProgress && steps % progressInterval === 0) {
      const shouldContinue = onProgress(steps, grid);
      if (!shouldContinue) {
        return { result: null, reason: "Generation was cancelled" };
      }
    }

    if (assignments.size === slots.length) {
      return {
        grid: cloneGrid(grid),
        assignments: new Map(assignments),
        steps,
      };
    }

    const next = pickNextSlot(
      slots,
      assignments,
      grid,
      dictByLen,
      usedWords,
      allowReuseWords,
    );
    if (!next) {
      // During backtracking, this might just mean we need to try a different path
      // But if we're at the top level with no candidates, it's a fatal error
      // For now, return null to allow backtracking to continue
      // We'll track this at a higher level if needed
      return {
        result: null,
        reason: "No candidates available for remaining slots",
      };
    }

    const { slot, candidates } = next;
    const ordered = randomizeCandidates ? shuffled(candidates) : candidates;

    for (const word of ordered) {
      if (!allowReuseWords && usedWords.has(word)) continue;

      const placed = tryPlaceWord(grid, slot, word);
      if (!placed) continue;

      assignments.set(slot.id, word);
      usedWords.add(word);

      const solved = backtrack();
      if (solved && "grid" in solved) return solved;

      assignments.delete(slot.id);
      if (!allowReuseWords) usedWords.delete(word);
      undoPlacement(grid, placed);
    }

    // No valid word found for this slot in this branch, allow backtracking
    return {
      result: null,
      reason: "No valid word candidates for current slot",
    };
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
    const maybeCell = slot.cells[i];
    if (!maybeCell) continue;
    const { r, c } = maybeCell;
    const maybeRow = grid[r];
    if (!maybeRow) return null;
    const existing = maybeRow[c] ?? "";
    const ch = word[i];
    if (!ch) continue;
    if (existing !== "" && existing !== ch) {
      return null;
    }
    if (existing === "") {
      changes.push({ r, c, prev: existing });
      maybeRow[c] = ch;
    }
  }

  return changes;
}

function undoPlacement(
  grid: string[][],
  changes: ReadonlyArray<{ r: number; c: number; prev: string }>,
): void {
  for (const { r, c, prev } of changes) {
    const maybeRow = grid[r];
    if (!maybeRow) continue;
    maybeRow[c] = prev;
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
    if (candidates.length === 0) {
      console.error(`No candidates found for slot ${slot.id}`);
      return null;
    }
    const filtered = allowReuseWords
      ? candidates
      : candidates.filter((w) => !usedWords.has(w));

    if (filtered.length === 0) {
      console.error(`No filtered candidates found for slot ${slot.id}`);
      return null;
    }

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
  const constraints = slot.cells.map(({ r, c }) => grid[r]?.[c] ?? "");

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
  if (h === 0) return slots;
  const maybeFirstRow = shape[0];
  if (!maybeFirstRow) return slots;
  const w = maybeFirstRow.length;

  for (let r = 0; r < h; r++) {
    const maybeRow = shape[r];
    if (!maybeRow) continue;
    let c = 0;
    while (c < w) {
      const start = c;
      while (c < w && maybeRow[c] === true) c++;
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
      while (r < h) {
        const maybeRow = shape[r];
        if (!maybeRow) break;
        if (maybeRow[c] !== true) break;
        r++;
      }
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
