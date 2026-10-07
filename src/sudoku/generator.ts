import {
  Difficulty,
  SudokuBoard,
  SudokuPuzzle,
} from './types';

import {
  countSolutions,
  isValidPlacement,
} from './solver';

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function createEmptyBoard(): SudokuBoard {
  return Array.from(
    { length: 9 },
    () => Array(9).fill(0)
  );
}

function fillBoard(board: SudokuBoard): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const numbers = shuffle([
          1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);

        for (const number of numbers) {
          if (
            isValidPlacement(
              board,
              row,
              col,
              number
            )
          ) {
            board[row][col] = number;

            if (fillBoard(board)) {
              return true;
            }

            board[row][col] = 0;
          }
        }

        return false;
      }
    }
  }

  return true;
}

function getClueCount(
  difficulty: Difficulty
): number {
  switch (difficulty) {
    case 'easy':
      return 42;

    case 'medium':
      return 34;

    case 'hard':
      return 27;

    default:
      return 42;
  }
}

function removeNumbers(
  solution: SudokuBoard,
  difficulty: Difficulty
): SudokuBoard {
  const puzzle = solution.map((row) => [...row]);

  const clueCount = getClueCount(difficulty);

  const cells = shuffle(
    Array.from({ length: 81 }, (_, index) => index)
  );

  let currentClues = 81;

  for (const cell of cells) {
    if (currentClues <= clueCount) {
      break;
    }

    const row = Math.floor(cell / 9);
    const col = cell % 9;

    const originalValue = puzzle[row][col];

    // Temporarily remove the number.
    puzzle[row][col] = 0;

    // Test a copy so the actual puzzle isn't changed
    // by the solution counter.
    const testBoard = puzzle.map((row) => [...row]);

    const solutions = countSolutions(testBoard);

    if (solutions === 1) {
      // Safe removal: puzzle still has exactly one solution.
      currentClues--;
    } else {
      // Removing this number created multiple solutions.
      // Put it back.
      puzzle[row][col] = originalValue;
    }
  }

  return puzzle;
}

export function generateSudoku(
  difficulty: Difficulty = 'easy'
): SudokuPuzzle {
  const solution = createEmptyBoard();

  const success = fillBoard(solution);

  if (!success) {
    throw new Error(
      'Unable to generate Sudoku board.'
    );
  }

  const puzzle = removeNumbers(
    solution,
    difficulty
  );

  return {
    puzzle,
    solution,
    difficulty,
  };
}