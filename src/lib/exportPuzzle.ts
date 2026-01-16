import { getClueNumbers } from "./crosswordFill";

export interface PuzzleExportData {
  version: 1;
  createdAt: string;
  gridSize: { rows: number; cols: number };
  shape: boolean[][];
  filledGrid: string[][];
  clues: {
    across: Array<{ number: number; word: string }>;
    down: Array<{ number: number; word: string }>;
  };
}

export function buildExportData(
  shape: boolean[][],
  filledGrid: string[][],
  assignments: Map<string, string>
): PuzzleExportData {
  const clueNumbers = getClueNumbers(shape);
  const h = shape.length;
  const w = shape[0]?.length ?? 0;

  const across: Array<{ number: number; word: string }> = [];
  const down: Array<{ number: number; word: string }> = [];

  // Extract across clues
  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      const start = c;
      while (c < w && shape[r]![c]) c++;
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
      while (r < h && shape[r]![c]) r++;
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
    version: 1,
    createdAt: new Date().toISOString(),
    gridSize: { rows: h, cols: w },
    shape,
    filledGrid,
    clues: {
      across: across.sort((a, b) => a.number - b.number),
      down: down.sort((a, b) => a.number - b.number),
    },
  };
}

export function exportAsJson(
  shape: boolean[][],
  filledGrid: string[][],
  assignments: Map<string, string>
): void {
  const data = buildExportData(shape, filledGrid, assignments);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `crossword-${formatDate()}.json`);
}

export function exportAsPng(
  shape: boolean[][],
  filledGrid: string[][],
  options: { cellSize?: number; showAnswers?: boolean } = {}
): void {
  const { cellSize = 40, showAnswers = true } = options;
  const clueNumbers = getClueNumbers(shape);

  const h = shape.length;
  const w = shape[0]?.length ?? 0;
  const padding = 20;
  const canvasWidth = w * cellSize + padding * 2;
  const canvasHeight = h * cellSize + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw cells
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const x = padding + c * cellSize;
      const y = padding + r * cellSize;
      const isWhite = shape[r]![c];

      // Fill cell
      ctx.fillStyle = isWhite ? "#ffffff" : "#1a1a1a";
      ctx.fillRect(x, y, cellSize, cellSize);

      // Border
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (isWhite) {
        // Clue number
        const clueNum = clueNumbers.get(`${r}:${c}`);
        if (clueNum) {
          ctx.fillStyle = "#666666";
          ctx.font = `${cellSize * 0.22}px sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(String(clueNum), x + 3, y + 2);
        }

        // Letter
        if (showAnswers) {
          const letter = filledGrid[r]?.[c];
          if (letter && letter !== "#" && letter !== "") {
            ctx.fillStyle = "#1a1a1a";
            ctx.font = `bold ${cellSize * 0.55}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(letter, x + cellSize / 2, y + cellSize / 2);
          }
        }
      }
    }
  }

  // Outer border (thicker)
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.strokeRect(padding, padding, w * cellSize, h * cellSize);

  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `crossword-${formatDate()}.png`);
    }
  }, "image/png");
}

export async function exportAsPdf(
  shape: boolean[][],
  filledGrid: string[][],
  assignments: Map<string, string>,
  options: { showAnswers?: boolean } = {}
): Promise<void> {
  const { showAnswers = true } = options;
  const { jsPDF } = await import("jspdf");

  const clueNumbers = getClueNumbers(shape);
  const h = shape.length;
  const w = shape[0]?.length ?? 0;

  // A4 dimensions in mm
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Title
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("Crossword Puzzle", pageWidth / 2, margin + 5, { align: "center" });

  // Calculate grid dimensions to fit nicely
  const maxGridWidth = pageWidth - margin * 2;
  const maxGridHeight = 120; // Leave room for clues
  const cellSize = Math.min(maxGridWidth / w, maxGridHeight / h, 8);
  const gridWidth = w * cellSize;
  const gridHeight = h * cellSize;
  const gridX = (pageWidth - gridWidth) / 2;
  const gridY = margin + 15;

  // Draw grid
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const x = gridX + c * cellSize;
      const y = gridY + r * cellSize;
      const isWhite = shape[r]![c];

      if (isWhite) {
        pdf.setFillColor(255, 255, 255);
      } else {
        pdf.setFillColor(30, 30, 30);
      }
      pdf.rect(x, y, cellSize, cellSize, "FD");

      if (isWhite) {
        // Clue number
        const clueNum = clueNumbers.get(`${r}:${c}`);
        if (clueNum) {
          pdf.setFontSize(cellSize * 0.3 * 2.83); // Convert mm to pt roughly
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);
          pdf.text(String(clueNum), x + 0.5, y + cellSize * 0.25);
        }

        // Letter
        if (showAnswers) {
          const letter = filledGrid[r]?.[c];
          if (letter && letter !== "#" && letter !== "") {
            pdf.setFontSize(cellSize * 0.6 * 2.83);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(0, 0, 0);
            pdf.text(letter, x + cellSize / 2, y + cellSize * 0.7, {
              align: "center",
            });
          }
        }
      }
    }
  }

  // Outer border
  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.5);
  pdf.rect(gridX, gridY, gridWidth, gridHeight);

  // Clues section
  const data = buildExportData(shape, filledGrid, assignments);
  const cluesY = gridY + gridHeight + 15;

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);

  const colWidth = (pageWidth - margin * 2) / 2;

  // Across clues
  pdf.text("ACROSS", margin, cluesY);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  let acrossY = cluesY + 5;
  for (const clue of data.clues.across) {
    if (acrossY > pageHeight - margin) break;
    pdf.text(`${clue.number}. ${clue.word}`, margin, acrossY);
    acrossY += 4;
  }

  // Down clues
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("DOWN", margin + colWidth, cluesY);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  let downY = cluesY + 5;
  for (const clue of data.clues.down) {
    if (downY > pageHeight - margin) break;
    pdf.text(`${clue.number}. ${clue.word}`, margin + colWidth, downY);
    downY += 4;
  }

  pdf.save(`crossword-${formatDate()}.pdf`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}
