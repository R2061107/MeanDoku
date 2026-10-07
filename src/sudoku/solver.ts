import { SudokuBoard } from './types';

export function isValidPlacement(
  board: SudokuBoard,
  row: number,
  col: number,
  number: number
): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === number) {
      return false;
    }
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === number) {
      return false;
    }
  }

  // Check 3x3 box
  const boxStartRow = Math.floor(row / 3) * 3;
  const boxStartCol = Math.floor(col / 3) * 3;

  for (let r = boxStartRow; r < boxStartRow + 3; r++) {
    for (let c = boxStartCol; c < boxStartCol + 3; c++) {
      if (board[r][c] === number) {
        return false;
      }
    }
  }

  return true;
}

export function solveSudoku(board: SudokuBoard): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        for (let number = 1; number <= 9; number++) {
          if (isValidPlacement(board, row, col, number)) {
            board[row][col] = number;

            if (solveSudoku(board)) {
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

export function countSolutions(
  board: SudokuBoard,
  limit: number = 2
): number {
  let count = 0;

  function solve(): void {
    if (count >= limit) {
      return;
    }

    let emptyRow = -1;
    let emptyCol = -1;

    // Find the next empty cell
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          emptyRow = row;
          emptyCol = col;
          break;
        }
      }

      if (emptyRow !== -1) {
        break;
      }
    }

    // No empty cells means we found a solution
    if (emptyRow === -1) {
      count++;
      return;
    }

    for (let number = 1; number <= 9; number++) {
      if (
        isValidPlacement(
          board,
          emptyRow,
          emptyCol,
          number
        )
      ) {
        board[emptyRow][emptyCol] = number;

        solve();

        // Backtrack
        board[emptyRow][emptyCol] = 0;

        // We only care whether there is more than one solution
        if (count >= limit) {
          return;
        }
      }
    }
  }

  solve();

  return count;
}