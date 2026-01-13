export const GRID_PRESETS = {
  small: { name: "5×5", size: 5 },
  medium: { name: "7×7", size: 7 },
  large: { name: "9×9", size: 9 },
  classic: { name: "11×11", size: 11 },
} as const;

/**
 * Default grid shapes for each size.
 * true = white cell (can have a letter), false = black cell (blocked)
 * Each array is [row][column], where row 0 is the top and column 0 is the left.
 */
const DEFAULT_SHAPES: Record<number, boolean[][]> = {
  // 5×5 grid - all white cells
  5: [
    [true, true, true, true, true],
    [true, true, true, true, true],
    [true, true, true, true, true],
    [true, true, true, true, true],
    [true, true, true, true, true],
  ],

  // 7×7 grid - center black square
  7: [
    [false, false, true, true, true, false, false],
    [false, true, true, true, true, true, false],
    [true, true, true, true, true, true, true],
    [true, true, true, false, true, true, true],
    [true, true, true, true, true, true, true],
    [false, true, true, true, true, true, false],
    [false, false, true, true, true, false, false],
  ],

  // 9×9 grid - center and four corners black squares
  9: [
    [false, false, true, true, true, true, true, false, false],
    [false, true, true, true, true, true, true, true, false],
    [true, true, true, true, true, true, true, true, true],
    [true, true, true, false, false, false, true, true, true],
    [true, true, true, false, false, false, true, true, true],
    [true, true, true, false, false, false, true, true, true],
    [true, true, true, true, true, true, true, true, true],
    [false, true, true, true, true, true, true, true, false],
    [false, false, true, true, true, true, true, false, false],
  ],

  // 11×11 grid - center, corners, and additional pattern
  11: [
    [false, false, false, true, true, true, true, true, false, false, false],
    [false, false, true, true, true, true, true, true, true, false, false],
    [false, true, true, true, true, true, true, true, true, true, false],
    [true, true, true, true, true, false, true, true, true, true, true],
    [true, true, true, true, false, false, false, true, true, true, true],
    [true, true, true, false, false, false, false, false, true, true, true],
    [true, true, true, true, false, false, false, true, true, true, true],
    [true, true, true, true, true, false, true, true, true, true, true],
    [false, true, true, true, true, true, true, true, true, true, false],
    [false, false, true, true, true, true, true, true, true, false, false],
    [false, false, false, true, true, true, true, true, false, false, false],
  ],
};

/**
 * Returns the default crossword grid shape for a given size.
 * @param size - The grid size (e.g., 5, 7, 9, 11)
 * @returns A 2D boolean array where true = white cell, false = black cell
 */
export function createDefaultShape(size: number): boolean[][] {
  const shape = DEFAULT_SHAPES[size];
  if (!shape) {
    // Fallback: return empty grid if size not found
    return Array(size)
      .fill(null)
      .map(() => Array(size).fill(true));
  }
  // Return a deep copy to prevent mutations
  return shape.map((row) => [...row]);
}
