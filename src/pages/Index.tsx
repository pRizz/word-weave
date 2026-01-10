import { useState, useCallback } from "react";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { CluesList } from "@/components/CluesList";
import { Button } from "@/components/ui/button";
import { fillCrossword } from "@/lib/crosswordFill";
import { DEFAULT_WORD_LIST } from "@/lib/wordList";
import { Sparkles, RotateCcw, Grid3X3, Loader2 } from "lucide-react";

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
        (size >= 7 && r === Math.floor(size / 2) && c === Math.floor(size / 2)) ||
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
    createDefaultShape(GRID_PRESETS.medium.size)
  );
  const [filledGrid, setFilledGrid] = useState<string[][] | null>(null);
  const [assignments, setAssignments] = useState<Map<string, string>>(
    new Map()
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isEditing) return;

      setShape((prev) => {
        const newShape = prev.map((r) => [...r]);
        newShape[row]![col] = !newShape[row]![col];
        return newShape;
      });
      setFilledGrid(null);
      setAssignments(new Map());
      setError(null);
    },
    [isEditing]
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
    setIsGenerating(true);
    setError(null);

    // Use setTimeout to allow UI to update before heavy computation
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const result = fillCrossword(shape, DEFAULT_WORD_LIST, {
        minWordLength: 2,
        allowReuseWords: false,
        randomizeCandidates: true,
        maxSteps: 500000,
      });

      if (result) {
        setFilledGrid(result.grid);
        setAssignments(result.assignments);
        setIsEditing(false);
      } else {
        setError(
          "Couldn't fill this grid pattern. Try adjusting the black squares or using a different layout."
        );
      }
    } catch (e) {
      setError("An error occurred while generating the puzzle.");
    } finally {
      setIsGenerating(false);
    }
  }, [shape]);

  const handleReset = () => {
    setShape(createDefaultShape(GRID_PRESETS[gridSize].size));
    setFilledGrid(null);
    setAssignments(new Map());
    setError(null);
    setIsEditing(true);
  };

  const handleClear = () => {
    setFilledGrid(null);
    setAssignments(new Map());
    setError(null);
    setIsEditing(true);
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
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-sans text-muted-foreground">
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
                  className="font-sans"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="font-sans"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reset Grid
            </Button>

            {filledGrid && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClear}
                className="font-sans"
              >
                <Grid3X3 className="w-4 h-4 mr-1.5" />
                Edit Grid
              </Button>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="font-sans"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Generate Puzzle
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Instructions */}
        {isEditing && !filledGrid && (
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
            <div className="animate-scale-in">
              <CrosswordGrid
                shape={shape}
                filledGrid={filledGrid}
                onCellClick={handleCellClick}
                isEditing={isEditing}
                cellSize={Math.min(45, Math.max(32, 400 / shape.length))}
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
