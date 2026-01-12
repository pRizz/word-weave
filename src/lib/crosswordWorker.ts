// Web Worker for crossword puzzle generation

import { fillCrossword } from "@/lib/crosswordFill";
import type { CrosswordFillOptions } from "@/lib/crosswordFill";

export type { CrosswordFillOptions } from "@/lib/crosswordFill";

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

  if (msg.type !== "start") return;

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
        return true;
      },
    );

    if (cancelled) return;

    const elapsedMs = performance.now() - startTime;

    if (result.ok) {
      self.postMessage({
        type: "complete",
        grid: result.grid,
        assignments: Array.from(result.assignments.entries()),
        elapsedMs,
        backtracks: result.steps,
      } as WorkerResponse);
      return;
    }

    const errorReason = result.reason;
    console.error(`[Crossword Generation Failed] ${errorReason}`);
    self.postMessage({
      type: "complete",
      grid: null,
      assignments: null,
      elapsedMs,
      backtracks: totalSteps,
      errorReason,
    } as WorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    } as WorkerResponse);
  }
};

function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => row.slice());
}

