import { useMemo } from "react";
import { getClueNumbers } from "@/lib/crosswordFill";

interface CluesListProps {
  shape: boolean[][];
  assignments: Map<string, string>;
}

interface ClueEntry {
  number: number;
  word: string;
}

export function CluesList({ shape, assignments }: CluesListProps) {
  const { acrossClues, downClues } = useMemo(() => {
    const clueNumbers = getClueNumbers(shape);
    const h = shape.length;
    const w = shape[0]?.length ?? 0;

    const across: ClueEntry[] = [];
    const down: ClueEntry[] = [];

    // Extract across clues
    for (let r = 0; r < h; r++) {
      let c = 0;
      while (c < w) {
        const start = c;
        while (c < w && shape[r]![c]!) c++;
        const runLen = c - start;
        if (runLen >= 2) {
          const slotId = `A:${r}:${start}`;
          const word = assignments.get(slotId);
          const num = clueNumbers.get(`${r}:${start}`);
          if (word && num) {
            across.push({ number: num, word });
          }
        }
        c++;
      }
    }

    // Extract down clues
    for (let c = 0; c < w; c++) {
      let r = 0;
      while (r < h) {
        const start = r;
        while (r < h && shape[r]![c]!) r++;
        const runLen = r - start;
        if (runLen >= 2) {
          const slotId = `D:${start}:${c}`;
          const word = assignments.get(slotId);
          const num = clueNumbers.get(`${start}:${c}`);
          if (word && num) {
            down.push({ number: num, word });
          }
        }
        r++;
      }
    }

    return {
      acrossClues: across.sort((a, b) => a.number - b.number),
      downClues: down.sort((a, b) => a.number - b.number),
    };
  }, [shape, assignments]);

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-serif font-semibold mb-3 text-foreground">
          Across
        </h3>
        <ul className="space-y-1.5">
          {acrossClues.map((clue) => (
            <li
              key={`across-${clue.number}`}
              className="text-sm font-sans text-muted-foreground"
            >
              <span className="font-medium text-foreground mr-2">
                {clue.number}.
              </span>
              <span className="font-mono tracking-wider">{clue.word}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-serif font-semibold mb-3 text-foreground">
          Down
        </h3>
        <ul className="space-y-1.5">
          {downClues.map((clue) => (
            <li
              key={`down-${clue.number}`}
              className="text-sm font-sans text-muted-foreground"
            >
              <span className="font-medium text-foreground mr-2">
                {clue.number}.
              </span>
              <span className="font-mono tracking-wider">{clue.word}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
