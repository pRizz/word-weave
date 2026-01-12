#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const inputPath = join(process.cwd(), "public", "core.txt");
const outputPath = join(process.cwd(), "public", "core.normalized.txt");

function normalizeCore() {
  console.log(`Reading ${inputPath}...`);
  const content = readFileSync(inputPath, "utf-8");
  const lines = content.split("\n");

  const normalizedLines: string[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // Skip empty lines
    if (trimmedLine === "") {
      normalizedLines.push("");
      continue;
    }

    // Strip underscores and hyphens
    const stripped = trimmedLine.replace(/[_'-\s,./=]/g, "");

    // Check if remaining characters are all alphabetic
    if (!/^[a-zA-Z]*$/.test(stripped)) {
      const invalidChars = stripped.match(/[^a-zA-Z]/g);
      throw new Error(
        `Line ${lineNumber}: Non-alpha character detected after stripping underscores and hyphens.\n` +
          `  Original: "${trimmedLine}"\n` +
          `  Stripped: "${stripped}"\n` +
          `  Invalid characters: ${invalidChars?.join(", ") || "unknown"}`,
      );
    }

    normalizedLines.push(stripped);
  }

  const output = normalizedLines.join("\n");
  writeFileSync(outputPath, output, "utf-8");

  console.log(`Successfully normalized ${lines.length} lines`);
  console.log(`Output written to ${outputPath}`);
}

try {
  normalizeCore();
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
}
