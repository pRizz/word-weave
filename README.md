# Word Weave - Crossword Generator

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)
![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?logo=vite)
![License](https://img.shields.io/badge/license-MIT-green.svg)

An interactive web application for generating crossword puzzles. Design custom grid layouts and automatically fill them with words from a comprehensive dictionary using an intelligent backtracking algorithm.

## Features

- 🎨 **Custom Grid Design**: Click cells to toggle between white (letter cells) and black (blocked cells)
- 📐 **Multiple Grid Sizes**: Choose from 5×5, 7×7, 9×9, or 11×11 grid presets
- 🤖 **Intelligent Generation**: Uses a backtracking algorithm with web worker support for non-blocking puzzle generation
- 📚 **Comprehensive Dictionary**: Loads from a normalized word list with 40,000+ words
- 📊 **Real-time Progress**: View generation progress with backtrack counts and elapsed time
- 🎯 **Word Tracking**: See all words used in the generated puzzle
- 📱 **Responsive Design**: Modern UI built with shadcn/ui components and Tailwind CSS

## Tech Stack

- **Frontend Framework**: React 18.3 with TypeScript
- **Build Tool**: Vite 5.4
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Hooks
- **Web Workers**: For background puzzle generation
- **Routing**: React Router DOM

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone git@github.com:pRizz/word-weave.git
cd word-weave
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run normalize-core` - Normalize the core dictionary file

## Usage

1. **Design Your Grid**: Click on cells to toggle them between white (letter cells) and black (blocked cells)
2. **Choose Grid Size**: Select from the preset sizes (5×5, 7×7, 9×9, 11×11)
3. **Generate Puzzle**: Click the "Generate" button to fill the grid with words
4. **View Results**: Once generated, view the filled grid and the list of words used
5. **Edit or Reset**: Use "Edit" to modify the grid or "Reset" to start over

## Project Structure

```
word-weave/
├── public/
│   ├── core.normalized.txt    # Normalized dictionary file
│   └── dictionary.txt          # Full dictionary source
├── src/
│   ├── components/            # React components
│   │   ├── CrosswordGrid.tsx  # Main grid display component
│   │   ├── CluesList.tsx      # Word list display
│   │   └── ui/                # shadcn/ui components
│   ├── hooks/
│   │   └── useCrosswordWorker.ts  # Web worker hook
│   ├── lib/
│   │   ├── crosswordFill.ts   # Core crossword filling algorithm
│   │   ├── crosswordWorker.ts # Web worker implementation
│   │   └── wordList.ts        # Dictionary loading utilities
│   ├── config/
│   │   └── dictionary.ts      # Dictionary configuration
│   └── pages/
│       └── Index.tsx          # Main application page
└── scripts/
    └── normalize-core.ts      # Dictionary normalization script
```

## Algorithm

The crossword generation uses a backtracking algorithm that:

1. Extracts word slots (horizontal and vertical) from the grid pattern
2. Orders slots by constraint (fewer candidates first)
3. Attempts to place words while respecting intersections
4. Backtracks when no valid word can be placed
5. Uses randomization for variety in generated puzzles

Generation runs in a web worker to keep the UI responsive during long-running operations.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
