import { useState, useCallback, useEffect } from "react";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { CluesList } from "@/components/CluesList";
import { Button } from "@/components/ui/button";
import { useCrosswordWorker } from "@/hooks/useCrosswordWorker";
import { DEFAULT_WORD_LIST, fetchDictionaryWords } from "@/lib/wordList";
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
  const [filledGrid, setFilledGrid] = useState<string[][] | null>(null);
  const [assignments, setAssignments] = useState<Map<string, string>>(
    new Map(),
  );
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationStats, setGenerationStats] = useState<{
    elapsedMs: number;
    backtracks: number;
  } | null>(null);

  const { generate, cancel, isGenerating, progress } = useCrosswordWorker();

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
      setFilledGrid(null);
      setAssignments(new Map());
      setError(null);
    },
    [isEditing, isGenerating],
  );

  const handleGridSizeChange = (size: keyof typeof GRID_PRESETS) => {
    setGridSize(size);
    setShape(createDefaultShape(GRID_PRESETS[size].size));
    setFilledGrid(null);
    setAssignments(new Map());
    setError(null);
    setIsEditing(true);
  };

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGenerationStats(null);

    try {
      const result = await generate(shape, dictionary, {
        minWordLength: DEFAULT_DICTIONARY_CONFIG.minWordLength,
        allowReuseWords: false,
        randomizeCandidates: true,
        maxSteps: 500000,
      });

      if (result.grid && result.assignments) {
        setFilledGrid(result.grid);
        setAssignments(result.assignments);
        setIsEditing(false);
        setGenerationStats({
          elapsedMs: result.elapsedMs,
          backtracks: result.backtracks,
        });
      } else {
        setError(
          "Couldn't fill this grid pattern. Try adjusting the black squares or using a different layout.",
        );
      }
    } catch (e) {
      setError("An error occurred while generating the puzzle.");
    }
  }, [shape, dictionary, generate]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleReset = () => {
    setShape(createDefaultShape(GRID_PRESETS[gridSize].size));
    setFilledGrid(null);
    setAssignments(new Map());
    setError(null);
    setIsEditing(true);
    setGenerationStats(null);
  };

  const handleClear = () => {
    setFilledGrid(null);
    setAssignments(new Map());
    setError(null);
    setIsEditing(true);
    setGenerationStats(null);
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

            {filledGrid && (
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
                disabled={isDictionaryLoading}
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
        {isGenerating && progress && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20 animate-fade-in">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="text-sm font-sans">
                <span className="font-medium text-foreground">
                  Generating...
                </span>
                <span className="text-muted-foreground ml-2">
                  <span className="font-mono tabular-nums">
                    {progress.steps.toLocaleString()}
                  </span>{" "}
                  backtracks
                </span>
                <span className="text-muted-foreground ml-2">
                  (
                  <span className="font-mono tabular-nums">
                    {(progress.elapsedMs / 1000).toFixed(1)}
                  </span>
                  s)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {isEditing && !filledGrid && !isGenerating && (
          <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-border animate-fade-in">
            <p className="text-sm font-sans text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Click
              cells to toggle between white (letters) and black (blocked). Then
              click "Generate Puzzle" to fill it with words.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 animate-fade-in">
            <p className="text-sm font-sans">{error}</p>
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
                  isGenerating && progress?.partialGrid
                    ? progress.partialGrid
                    : filledGrid
                }
                onCellClick={handleCellClick}
                isEditing={isEditing && !isGenerating}
                cellSize={Math.min(45, Math.max(32, 400 / shape.length))}
                tooltipMessage={
                  isGenerating
                    ? "Stop generation to edit the grid"
                    : filledGrid
                      ? "Reset the grid to edit it"
                      : undefined
                }
              />
            </div>
          </div>

          {/* Clues */}
          {filledGrid && assignments.size > 0 && (
            <div className="bg-card p-6 rounded-lg border border-border shadow-soft animate-fade-in">
              <h2 className="text-2xl font-serif font-semibold mb-4 text-foreground">
                Words Used
              </h2>
              <CluesList shape={shape} assignments={assignments} />
            </div>
          )}
        </div>

        {/* Stats */}
        {filledGrid && (
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
              {generationStats && (
                <>
                  <div>
                    <span className="text-foreground font-medium font-mono tabular-nums">
                      {(generationStats.elapsedMs / 1000).toFixed(2)}s
                    </span>{" "}
                    generation time
                  </div>
                  <div>
                    <span className="text-foreground font-medium font-mono tabular-nums">
                      {generationStats.backtracks.toLocaleString()}
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
