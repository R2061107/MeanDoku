export type Difficulty = 'easy' | 'medium' | 'hard';

export type SudokuBoard = number[][];

export interface SudokuPuzzle {
  puzzle: SudokuBoard;
  solution: SudokuBoard;
  difficulty: Difficulty;
}