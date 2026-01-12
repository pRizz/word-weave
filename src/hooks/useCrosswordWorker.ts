import { useRef, useCallback, useState } from "react";
import type {
  CrosswordFillOptions,
  WorkerMessage,
  WorkerResponse,
} from "@/lib/crosswordWorker";

export interface GenerationProgress {
  steps: number;
  elapsedMs: number;
  partialGrid: string[][];
}

export interface GenerationResult {
  grid: string[][] | null;
  assignments: Map<string, string> | null;
  elapsedMs: number;
  backtracks: number;
  errorReason?: string;
}

export function useCrosswordWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const generate = useCallback(
    (
      shape: boolean[][],
      dictionary: string[],
      options: CrosswordFillOptions = {},
    ): Promise<GenerationResult> => {
      return new Promise((resolve, reject) => {
        // Clean up any existing worker
        if (workerRef.current) {
          workerRef.current.terminate();
        }

        setIsGenerating(true);
        setProgress(null);

        // Create new worker
        const worker = new Worker(
          new URL("@/lib/crosswordWorker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const msg = e.data;

          if (msg.type === "progress") {
            setProgress({
              steps: msg.steps,
              elapsedMs: msg.elapsedMs,
              partialGrid: msg.partialGrid,
            });
          } else if (msg.type === "complete") {
            setIsGenerating(false);
            setProgress(null);
            worker.terminate();
            workerRef.current = null;

            if (msg.errorReason) {
              console.error(`[Crossword Generation Failed] ${msg.errorReason}`);
            }

            resolve({
              grid: msg.grid,
              assignments: msg.assignments ? new Map(msg.assignments) : null,
              elapsedMs: msg.elapsedMs,
              backtracks: msg.backtracks,
              errorReason: msg.errorReason,
            });
          } else if (msg.type === "error") {
            setIsGenerating(false);
            setProgress(null);
            worker.terminate();
            workerRef.current = null;
            const errorMessage =
              msg.message || "Unknown error occurred during generation";
            console.error(`[Crossword Generation Error] ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        };

        worker.onerror = (err) => {
          setIsGenerating(false);
          setProgress(null);
          worker.terminate();
          workerRef.current = null;
          const errorMessage =
            err.message || "Worker error: unknown error occurred";
          console.error(`[Crossword Worker Error] ${errorMessage}`, err);
          reject(new Error(errorMessage));
        };

        // Start generation
        const message: WorkerMessage = {
          type: "start",
          shape,
          dictionary,
          options,
        };
        worker.postMessage(message);
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "cancel" } as WorkerMessage);
      workerRef.current.terminate();
      workerRef.current = null;
      setIsGenerating(false);
      setProgress(null);
    }
  }, []);

  return {
    generate,
    cancel,
    isGenerating,
    progress,
  };
}
