import { useState, useCallback, useEffect, useMemo } from "react";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { CluesList } from "@/components/CluesList";
import { Button } from "@/components/ui/button";
import { useCrosswordWorker } from "@/hooks/useCrosswordWorker";
import { DEFAULT_WORD_LIST, fetchDictionaryWords } from "@/lib/wordList";
import { analyzeCrosswordShape, buildDictionaryIndex } from "@/lib/crosswordFill";
import { DEFAULT_DICTIONARY_CONFIG } from "@/config/dictionary";
import { Sparkles, RotateCcw, Grid3X3, Loader2, X } from "lucide-react";

const GRID_PRESETS = {
  small: { name: "5×5", size: 5 },
  medium: { name: "7×7", size: 7 },
  large: { name: "9×9", size: 9 },
  classic: { name: "11×11", size: 11 },
};

// Create a simple crossword pattern
function createDefaultShape(size: number): boolean[][] {
  const shape: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      // Create some black squares for visual interest (symmetric pattern)
      const isBlack =
        (size >= 7 &&
          r === Math.floor(size / 2) &&
          c === Math.floor(size / 2)) ||
        (size >= 9 && r === 1 && c === 1) ||
        (size >= 9 && r === 1 && c === size - 2) ||
        (size >= 9 && r === size - 2 && c === 1) ||
        (size >= 9 && r === size - 2 && c === size - 2) ||
        (size >= 11 && r === 3 && c === 5) ||
        (size >= 11 && r === 5 && c === 3) ||
        (size >= 11 && r === 5 && c === 7) ||
        (size >= 11 && r === 7 && c === 5);
      row.push(!isBlack);
    }
    shape.push(row);
  }
  return shape;
}

export default function Index() {
  const [gridSize, setGridSize] = useState<keyof typeof GRID_PRESETS>("medium");
  const [shape, setShape] = useState<boolean[][]>(() =>
    createDefaultShape(GRID_PRESETS.medium.size),
  );
  const [dictionary, setDictionary] = useState<string[]>(DEFAULT_WORD_LIST);
  const [maybeFilledGrid, setMaybeFilledGrid] = useState<string[][] | null>(
    null,
  );
  const [assignments, setAssignments] = useState<Map<string, string>>(
    new Map(),
  );
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [maybeError, setMaybeError] = useState<string | null>(null);
  const [maybeGenerationStats, setMaybeGenerationStats] = useState<{
    elapsedMs: number;
    backtracks: number;
  } | null>(null);

  const { generate, cancel, isGenerating, progress: maybeProgress } =
    useCrosswordWorker();

  const dictionaryIndex = useMemo(
    () => buildDictionaryIndex(dictionary),
    [dictionary],
  );

  const shapeAnalysis = useMemo(
    () =>
      analyzeCrosswordShape({
        shape,
        dictionaryIndex,
        minWordLength: DEFAULT_DICTIONARY_CONFIG.minWordLength,
        allowReuseWords: false,
      }),
    [shape, dictionaryIndex],
  );

  useEffect(() => {
    let isCancelled = false;

    fetchDictionaryWords()
      .then((words) => {
        if (isCancelled) return;
        if (words.length === 0) return;
        setDictionary(words);
      })
      .catch(() => {
        // Keep DEFAULT_WORD_LIST as a fallback if the dictionary can't be loaded.
      })
      .finally(() => {
        if (isCancelled) return;
        setIsDictionaryLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isEditing || isGenerating) return;

      setShape((prev) => {
        const newShape = prev.map((r) => [...r]);
        newShape[row]![col] = !newShape[row]![col];
        return newShape;
      });
      setMaybeFilledGrid(null);
      setAssignments(new Map());
      setMaybeError(null);
    },
    [isEditing, isGenerating],
  );

  const handleGridSizeChange = (size: keyof typeof GRID_PRESETS) => {
    setGridSize(size);
    setShape(createDefaultShape(GRID_PRESETS[size].size));
    setMaybeFilledGrid(null);
    setAssignments(new Map());
    setMaybeError(null);
    setIsEditing(true);
  };

  const handleGenerate = useCallback(async () => {
    setMaybeError(null);
    setMaybeGenerationStats(null);

    if (!shapeAnalysis.isValid) {
      const blocking = shapeAnalysis.issues.filter(
        (i) => i.severity === "error",
      );
      setMaybeError(
        blocking[0]?.message ??
          "This grid has issues that prevent generation. Fix the grid and try again.",
      );
      return;
    }

    try {
      const result = await generate(shape, dictionary, {
        minWordLength: DEFAULT_DICTIONARY_CONFIG.minWordLength,
        allowReuseWords: false,
        randomizeCandidates: true,
        maxSteps: 500000,
      });

      if (result.grid && result.assignments) {
        setMaybeFilledGrid(result.grid);
        setAssignments(result.assignments);
        setIsEditing(false);
        setMaybeGenerationStats({
          elapsedMs: result.elapsedMs,
          backtracks: result.backtracks,
        });
        return;
      }
      const errorMessage = result.maybeErrorReason
        ? `Couldn't fill this grid pattern: ${result.maybeErrorReason}`
        : "Couldn't fill this grid pattern. Try adjusting the black squares or using a different layout.";
      setMaybeError(errorMessage);
      if (result.maybeErrorReason) {
        console.error(
          `[Crossword Generation Failed] ${result.maybeErrorReason}`,
        );
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : "An error occurred while generating the puzzle.";
      setMaybeError(errorMessage);
      console.error(`[Crossword Generation Exception] ${errorMessage}`, e);
    }
  }, [shape, dictionary, generate, shapeAnalysis]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleReset = () => {
    setShape(createDefaultShape(GRID_PRESETS[gridSize].size));
    setMaybeFilledGrid(null);
    setAssignments(new Map());
    setMaybeError(null);
    setIsEditing(true);
    setMaybeGenerationStats(null);
  };

  const handleClear = () => {
    setMaybeFilledGrid(null);
    setAssignments(new Map());
    setMaybeError(null);
    setIsEditing(true);
    setMaybeGenerationStats(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border py-6">
        <div className="container max-w-5xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tight">
            Crossword Generator
          </h1>
          <p className="mt-2 text-muted-foreground font-sans">
            Design your grid, then generate a complete puzzle
          </p>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8 overflow-hidden">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-sans text-muted-foreground whitespace-nowrap">
              Grid size:
            </span>
            <div className="flex gap-1">
              {Object.entries(GRID_PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  variant={gridSize === key ? "default" : "secondary"}
                  size="sm"
                  onClick={() =>
                    handleGridSizeChange(key as keyof typeof GRID_PRESETS)
                  }
                  className="font-sans px-2 sm:px-3"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden sm:block flex-1" />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="font-sans flex-shrink-0"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reset
            </Button>

            {maybeFilledGrid && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClear}
                className="font-sans flex-shrink-0"
              >
                <Grid3X3 className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            )}

            {isGenerating ? (
              <Button
                onClick={handleCancel}
                variant="destructive"
                className="font-sans flex-shrink-0"
                size="sm"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={isDictionaryLoading || !shapeAnalysis.isValid}
                className="font-sans flex-shrink-0"
                size="sm"
              >
                {isDictionaryLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Generate
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        {isGenerating && maybeProgress && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20 animate-fade-in">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="text-sm font-sans">
                <span className="font-medium text-foreground">
                  Generating...
                </span>
                <span className="text-muted-foreground ml-2">
                  <span className="font-mono tabular-nums">
                    {maybeProgress.steps.toLocaleString()}
                  </span>{" "}
                  backtracks
                </span>
                <span className="text-muted-foreground ml-2">
                  (
                  <span className="font-mono tabular-nums">
                    {(maybeProgress.elapsedMs / 1000).toFixed(1)}
                  </span>
                  s)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {isEditing && !maybeFilledGrid && !isGenerating && (
          <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-border animate-fade-in">
            <p className="text-sm font-sans text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Click
              cells to toggle between white (letters) and black (blocked). Then
              click "Generate Puzzle" to fill it with words.
            </p>
          </div>
        )}

        {/* Live grid validation */}
        {isEditing && !isGenerating && shapeAnalysis.issues.length > 0 && (
          <div
            className={`mb-6 p-4 rounded-lg border animate-fade-in ${
              shapeAnalysis.isValid
                ? "bg-primary/5 border-primary/20"
                : "bg-destructive/10 border-destructive/20"
            }`}
          >
            <p
              className={`text-sm font-sans ${
                shapeAnalysis.isValid ? "text-foreground" : "text-destructive"
              }`}
            >
              {shapeAnalysis.isValid
                ? "Grid warnings:"
                : "Fix these grid issues before generating:"}
            </p>
            <ul className="mt-2 space-y-1 text-sm font-sans">
              {shapeAnalysis.issues.map((issue) => (
                <li
                  key={`${issue.code}:${issue.message}`}
                  className={
                    issue.severity === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  - {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error message */}
        {maybeError && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 animate-fade-in">
            <p className="text-sm font-sans">{maybeError}</p>
          </div>
        )}

        {/* Grid and Clues */}
        <div className="grid lg:grid-cols-[auto_1fr] gap-8 items-start">
          {/* Grid */}
          <div className="flex justify-center lg:justify-start">
            <div
              className={`animate-scale-in ${isGenerating ? "relative" : ""}`}
            >
              {isGenerating && (
                <div className="absolute inset-0 bg-primary/5 rounded-lg pointer-events-none z-10 animate-pulse" />
              )}
              <CrosswordGrid
                shape={shape}
                filledGrid={
                  isGenerating && maybeProgress?.partialGrid
                    ? maybeProgress.partialGrid
                    : maybeFilledGrid
                }
                onCellClick={handleCellClick}
                isEditing={isEditing && !isGenerating}
                cellSize={Math.min(45, Math.max(32, 400 / shape.length))}
                tooltipMessage={
                  isGenerating
                    ? "Stop generation to edit the grid"
                    : maybeFilledGrid
                      ? "Reset the grid to edit it"
                      : undefined
                }
              />
            </div>
          </div>

          {/* Clues */}
          {maybeFilledGrid && assignments.size > 0 && (
            <div className="bg-card p-6 rounded-lg border border-border shadow-soft animate-fade-in">
              <h2 className="text-2xl font-serif font-semibold mb-4 text-foreground">
                Words Used
              </h2>
              <CluesList shape={shape} assignments={assignments} />
            </div>
          )}
        </div>

        {/* Stats */}
        {maybeFilledGrid && (
          <div className="mt-8 pt-6 border-t border-border animate-fade-in">
            <div className="flex flex-wrap gap-6 text-sm font-sans text-muted-foreground">
              <div>
                <span className="text-foreground font-medium">
                  {assignments.size}
                </span>{" "}
                words placed
              </div>
              <div>
                <span className="text-foreground font-medium">
                  {shape.flat().filter(Boolean).length}
                </span>{" "}
                letter cells
              </div>
              <div>
                <span className="text-foreground font-medium">
                  {shape.length}×{shape[0]?.length}
                </span>{" "}
                grid
              </div>
              {maybeGenerationStats && (
                <>
                  <div>
                    <span className="text-foreground font-medium font-mono tabular-nums">
                      {(maybeGenerationStats.elapsedMs / 1000).toFixed(2)}s
                    </span>{" "}
                    generation time
                  </div>
                  <div>
                    <span className="text-foreground font-medium font-mono tabular-nums">
                      {maybeGenerationStats.backtracks.toLocaleString()}
                    </span>{" "}
                    backtracks
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-6">
        <div className="container max-w-5xl mx-auto px-4">
          <p className="text-sm font-sans text-muted-foreground text-center">
            Click cells to design your grid pattern, then generate a complete
            crossword puzzle
          </p>
        </div>
      </footer>
    </div>
  );
}
