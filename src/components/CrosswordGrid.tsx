import { useMemo } from "react";
import { getClueNumbers } from "@/lib/crosswordFill";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CrosswordGridProps {
  shape: boolean[][];
  filledGrid?: string[][] | null;
  onCellClick?: (row: number, col: number) => void;
  isEditing?: boolean;
  cellSize?: number;
  tooltipMessage?: string;
}

export function CrosswordGrid({
  shape,
  filledGrid,
  onCellClick,
  isEditing = false,
  cellSize = 40,
  tooltipMessage,
}: CrosswordGridProps) {
  const clueNumbers = useMemo(() => getClueNumbers(shape), [shape]);

  const height = shape.length;
  const width = shape[0]?.length ?? 0;

  const gridContent = (
    <div
      className="inline-block border-2 border-primary shadow-heavy"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
      }}
    >
      {shape.map((row, r) =>
        row.map((isWhite, c) => {
          const clueNum = clueNumbers.get(`${r}:${c}`);
          const letter = filledGrid?.[r]?.[c];
          const showLetter = letter && letter !== "#" && letter !== "";

          return (
            <button
              key={`${r}-${c}`}
              onClick={() => onCellClick?.(r, c)}
              className={cn(
                "relative border border-primary/20 transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset",
                isWhite
                  ? "bg-cell-white hover:bg-cell-highlight"
                  : "bg-cell-black",
                isEditing && "cursor-pointer",
                !isEditing && isWhite && "cursor-default"
              )}
              style={{ width: cellSize, height: cellSize }}
              disabled={!isEditing && !isWhite}
            >
              {isWhite && clueNum && (
                <span
                  className="absolute font-sans font-medium text-foreground/70"
                  style={{
                    top: 2,
                    left: 3,
                    fontSize: cellSize * 0.22,
                    lineHeight: 1,
                  }}
                >
                  {clueNum}
                </span>
              )}
              {showLetter && (
                <span
                  className="absolute inset-0 flex items-center justify-center font-serif font-semibold text-foreground"
                  style={{ fontSize: cellSize * 0.55 }}
                >
                  {letter}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );

  if (tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{gridContent}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return gridContent;
}
