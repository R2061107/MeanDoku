import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { generateSudoku } from '../sudoku/generator';
import { Difficulty, SudokuPuzzle } from '../sudoku/types';

type BestTimes = {
  easy: number[];
  medium: number[];
  hard: number[];
};

type Screen = 'home' | 'game' | 'victory';

const BEST_TIMES_KEY = 'sudoku_best_times_v1';

const EMPTY_BEST_TIMES: BestTimes = {
  easy: [],
  medium: [],
  hard: [],
};

function createEmptyNotes(): number[][][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => [])
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

const SECTION_ROASTS = [
  "Guess you had to guess right eventually.",
  "Holy shit, you actually finished one.",
  "Even a broken clock gets it right twice a day.",
  "Look at you, pretending you know what you're doing.",
  "Well, that was unexpectedly competent.",
  "Congratulations, basic pattern recognition achieved.",
  "Don't get cocky. There's still plenty left to screw up.",
  "A whole section? Someone alert the media.",
  "You did it without a tutorial. Incredible.",
  "I'm as surprised as you are.",
  "That looked suspiciously like intelligence.",
  "Keep this up and I might have to stop insulting you.",
  "Not terrible. Don't worry, I'm sure you'll fix that.",
  "Somehow, against all odds, that was correct.",
  "Okay, Rain Man. Calm down.",
  "One section down. Try not to ruin it.",
  "Fine. I'll admit that one wasn't completely embarrassing.",
  "Did you solve that or did your thumb slip?",
  "There may be hope for you yet. Probably not.",
  "Well fuck me, you got one right.",
];

const WRONG_ROASTS = [
  "Got it wrong stupid.",
  "Numbers are hard, huh?",
  "Bold choice. Wrong, but bold.",
  "Not even fucking close.",
  "That number had one job.",
  "Impressive. You found the wrong answer.",
  "Maybe try looking at the puzzle this time.",
  "You really committed to being wrong there.",
  "Nine numbers and you still picked the wrong one.",
  "Outstanding work, genius.",
  "That was confidently incorrect.",
  "The square disagrees with your life choices.",
  "Math has filed a complaint.",
  "Swing and a miss, dumbass.",
  "You had a one-in-nine shot and still made it weird.",
  "Nope. Try using the thinking part.",
  "That answer was garbage. Try again.",
  "I admire the confidence. Not the answer.",
  "Wrong. Spectacularly ordinary, but wrong.",
  "The Sudoku would like an apology.",
];

function getRandomRoast(roasts: string[]): string {
  return roasts[Math.floor(Math.random() * roasts.length)];
}

function isUnitComplete(values: number[]): boolean {
  if (values.some((value) => value === 0)) {
    return false;
  }

  return new Set(values).size === 9;
}

function completedSectionCount(board: number[][]): number {
  let count = 0;

  for (let row = 0; row < 9; row++) {
    if (isUnitComplete(board[row])) {
      count++;
    }
  }

  for (let col = 0; col < 9; col++) {
    const column = board.map((row) => row[col]);

    if (isUnitComplete(column)) {
      count++;
    }
  }

  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const values: number[] = [];

      for (let row = boxRow * 3; row < boxRow * 3 + 3; row++) {
        for (let col = boxCol * 3; col < boxCol * 3 + 3; col++) {
          values.push(board[row][col]);
        }
      }

      if (isUnitComplete(values)) {
        count++;
      }
    }
  }

  return count;
}

export default function SudokuScreen() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>('easy');
  const [hasActiveGame, setHasActiveGame] = useState(false);

  const [game, setGame] = useState<SudokuPuzzle>(() =>
    generateSudoku('easy')
  );

  const [board, setBoard] = useState<number[][]>(() =>
    game.puzzle.map((row) => [...row])
  );

  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<number[][][]>(() =>
    createEmptyNotes()
  );

  // Tracks whether Auto Notes is currently active.
  // First press fills notes; second press clears all notes.
  const [autoNotesActive, setAutoNotesActive] = useState(false);

  // Each new game starts with exactly 3 hints.
  const [hintsRemaining, setHintsRemaining] = useState(3);

  const [roastMessage, setRoastMessage] = useState<string | null>(null);
  const [roastType, setRoastType] =
    useState<'wrong' | 'section' | 'hints'>('section');
  const roastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const [newBestRank, setNewBestRank] = useState<number | null>(null);

  const startTimeRef = useRef(Date.now());
  const accumulatedTimeRef = useRef(0);

  const [bestTimes, setBestTimes] = useState<BestTimes>({
    ...EMPTY_BEST_TIMES,
  });

  useEffect(() => {
    loadBestTimes();

    return () => {
      if (roastTimeoutRef.current) {
        clearTimeout(roastTimeoutRef.current);
      }
    };
  }, []);

  function showRoast(
    message: string,
    type: 'wrong' | 'section' | 'hints' = 'section'
  ) {
    if (roastTimeoutRef.current) {
      clearTimeout(roastTimeoutRef.current);
    }

    setRoastType(type);
    setRoastMessage(message);

    roastTimeoutRef.current = setTimeout(() => {
      setRoastMessage(null);
      roastTimeoutRef.current = null;
    }, 1800);
  }

  async function loadBestTimes() {
    try {
      const storedTimes = await AsyncStorage.getItem(BEST_TIMES_KEY);

      if (storedTimes) {
        const parsedTimes = JSON.parse(storedTimes);

        setBestTimes({
          easy: Array.isArray(parsedTimes.easy) ? parsedTimes.easy : [],
          medium: Array.isArray(parsedTimes.medium) ? parsedTimes.medium : [],
          hard: Array.isArray(parsedTimes.hard) ? parsedTimes.hard : [],
        });
      }
    } catch (error) {
      console.error('Unable to load best times:', error);
    }
  }

  useEffect(() => {
    if (screen !== 'game') {
      return;
    }

    const timer = setInterval(() => {
      const currentSessionSeconds = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );

      setElapsedSeconds(
        accumulatedTimeRef.current + currentSessionSeconds
      );
    }, 250);

    return () => clearInterval(timer);
  }, [screen]);

  function startGame(
    difficulty: Difficulty = selectedDifficulty
  ) {
    const newGame = generateSudoku(difficulty);

    setGame(newGame);
    setBoard(newGame.puzzle.map((row) => [...row]));
    setSelectedDifficulty(difficulty);
    setSelectedCell(null);
    setNotes(createEmptyNotes());
    setNotesMode(false);
    setAutoNotesActive(false);
    setHintsRemaining(3);
    setRoastMessage(null);

    if (roastTimeoutRef.current) {
      clearTimeout(roastTimeoutRef.current);
      roastTimeoutRef.current = null;
    }

    setCompletionTime(null);
    setNewBestRank(null);
    setElapsedSeconds(0);

    accumulatedTimeRef.current = 0;
    startTimeRef.current = Date.now();

    setHasActiveGame(true);
    setScreen('game');
  }

  function goHome() {
    if (screen === 'game') {
      const currentSessionSeconds = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );

      const pausedTime =
        accumulatedTimeRef.current + currentSessionSeconds;

      accumulatedTimeRef.current = pausedTime;
      setElapsedSeconds(pausedTime);
    }

    setSelectedCell(null);
    setNotesMode(false);
    setScreen('home');
  }

  function continueGame() {
    if (!hasActiveGame) {
      return;
    }

    startTimeRef.current = Date.now();
    setScreen('game');
  }

  async function recordBestTime(
    time: number,
    difficulty: Difficulty
  ) {
    const currentTimes = [...bestTimes[difficulty], time].sort(
      (a, b) => a - b
    );

    const rank = currentTimes.indexOf(time) + 1;
    const topFive = currentTimes.slice(0, 5);

    const updatedBestTimes: BestTimes = {
      ...bestTimes,
      [difficulty]: topFive,
    };

    setBestTimes(updatedBestTimes);
    setNewBestRank(rank <= 5 ? rank : null);

    try {
      await AsyncStorage.setItem(
        BEST_TIMES_KEY,
        JSON.stringify(updatedBestTimes)
      );
    } catch (error) {
      console.error('Unable to save best times:', error);
    }
  }

  function isBoardComplete(currentBoard: number[][]): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (
          currentBoard[row][col] !==
          game.solution[row][col]
        ) {
          return false;
        }
      }
    }

    return true;
  }

  function completeGame() {
    if (screen !== 'game') {
      return;
    }

    const currentSessionSeconds = Math.floor(
      (Date.now() - startTimeRef.current) / 1000
    );

    const finalTime =
      accumulatedTimeRef.current + currentSessionSeconds;

    setElapsedSeconds(finalTime);
    setCompletionTime(finalTime);
    setSelectedCell(null);
    setNotesMode(false);
    setHasActiveGame(false);

    recordBestTime(finalTime, game.difficulty);
    setScreen('victory');
  }

  function isCandidateLegal(
    currentBoard: number[][],
    row: number,
    col: number,
    number: number
  ): boolean {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[row][c] === number) {
        return false;
      }
    }

    for (let r = 0; r < 9; r++) {
      if (currentBoard[r][col] === number) {
        return false;
      }
    }

    const boxStartRow = Math.floor(row / 3) * 3;
    const boxStartCol = Math.floor(col / 3) * 3;

    for (let r = boxStartRow; r < boxStartRow + 3; r++) {
      for (let c = boxStartCol; c < boxStartCol + 3; c++) {
        if (currentBoard[r][c] === number) {
          return false;
        }
      }
    }

    return true;
  }

  function getCandidates(
    currentBoard: number[][],
    row: number,
    col: number
  ): number[] {
    if (currentBoard[row][col] !== 0) {
      return [];
    }

    const candidates: number[] = [];

    for (let number = 1; number <= 9; number++) {
      if (
        isCandidateLegal(
          currentBoard,
          row,
          col,
          number
        )
      ) {
        candidates.push(number);
      }
    }

    return candidates;
  }

  function buildAutoNotes(
    targetBoard: number[][]
  ): number[][][] {
    // Use original clues plus only correct player answers when
    // calculating candidates. A wrong red answer will not
    // incorrectly remove candidates from nearby cells.
    const effectiveBoard = targetBoard.map((row) => [...row]);

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (
          game.puzzle[row][col] === 0 &&
          effectiveBoard[row][col] !== 0 &&
          effectiveBoard[row][col] !== game.solution[row][col]
        ) {
          effectiveBoard[row][col] = 0;
        }
      }
    }

    const newNotes = createEmptyNotes();

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (targetBoard[row][col] === 0) {
          newNotes[row][col] = getCandidates(
            effectiveBoard,
            row,
            col
          );
        }
      }
    }

    return newNotes;
  }

  function toggleAutoNotes() {
    if (screen !== 'game') {
      return;
    }

    // Second press: clear every note on the board.
    if (autoNotesActive) {
      setNotes(createEmptyNotes());
      setAutoNotesActive(false);

      showRoast(
        'Fine. Put the training wheels away.',
        'section'
      );

      return;
    }

    // First press: generate every currently legal candidate.
    setNotes(buildAutoNotes(board));
    setAutoNotesActive(true);

    showRoast(
      'Need that much help, guess you are that dumb.',
      'hints'
    );
  }

  function removeNumberFromRelatedNotes(
    currentNotes: number[][][],
    row: number,
    col: number,
    number: number
  ): number[][][] {
    const newNotes = currentNotes.map((noteRow) =>
      noteRow.map((cellNotes) => [...cellNotes])
    );

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const sameRow = r === row;
        const sameColumn = c === col;
        const sameBox =
          Math.floor(r / 3) === Math.floor(row / 3) &&
          Math.floor(c / 3) === Math.floor(col / 3);

        if (sameRow || sameColumn || sameBox) {
          newNotes[r][c] = newNotes[r][c].filter(
            (note) => note !== number
          );
        }
      }
    }

    return newNotes;
  }

  function selectCell(row: number, col: number) {
    if (screen !== 'game') {
      return;
    }

    if (game.puzzle[row][col] !== 0) {
      return;
    }

    setSelectedCell({ row, col });
  }

  function enterNumber(number: number) {
    if (!selectedCell || screen !== 'game') {
      return;
    }

    const { row, col } = selectedCell;

    if (notesMode) {
      if (board[row][col] !== 0) {
        return;
      }

      const newNotes = notes.map((noteRow) =>
        noteRow.map((cellNotes) => [...cellNotes])
      );

      const cellNotes = newNotes[row][col];

      if (cellNotes.includes(number)) {
        newNotes[row][col] = cellNotes.filter(
          (note) => note !== number
        );
      } else {
        newNotes[row][col] = [
          ...cellNotes,
          number,
        ].sort((a, b) => a - b);
      }

      setNotes(newNotes);
      return;
    }

    const newBoard = board.map((boardRow) => [
      ...boardRow,
    ]);

    newBoard[row][col] = number;
    setBoard(newBoard);

    const copiedNotes = notes.map((noteRow) =>
      noteRow.map((cellNotes) => [...cellNotes])
    );

    copiedNotes[row][col] = [];

    const correctAnswer =
      number === game.solution[row][col];

    if (correctAnswer) {
      const cleanedNotes =
        removeNumberFromRelatedNotes(
          copiedNotes,
          row,
          col,
          number
        );

      cleanedNotes[row][col] = [];

      if (autoNotesActive) {
        setNotes(buildAutoNotes(newBoard));
      } else {
        setNotes(cleanedNotes);
      }

      if (isBoardComplete(newBoard)) {
        completeGame();
        return;
      }

      const sectionsBefore = completedSectionCount(board);
      const sectionsAfter = completedSectionCount(newBoard);

      if (sectionsAfter > sectionsBefore) {
        showRoast(
          getRandomRoast(SECTION_ROASTS),
          'section'
        );
      }

      return;
    }

    if (autoNotesActive) {
      setNotes(buildAutoNotes(newBoard));
    } else {
      setNotes(copiedNotes);
    }

    showRoast(getRandomRoast(WRONG_ROASTS), 'wrong');
  }

  // ========================================
  // HINTS - MAXIMUM 3 PER GAME
  // ========================================

  function useHint() {
    if (screen !== 'game' || hintsRemaining <= 0) {
      return;
    }

    // Any editable cell that is not currently correct
    // can receive a hint. This includes empty cells and
    // cells containing a wrong red answer.
    const unsolvedCells: {
      row: number;
      col: number;
    }[] = [];

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (game.puzzle[row][col] !== 0) {
          continue;
        }

        if (
          board[row][col] !==
          game.solution[row][col]
        ) {
          unsolvedCells.push({ row, col });
        }
      }
    }

    if (unsolvedCells.length === 0) {
      return;
    }

    const randomIndex = Math.floor(
      Math.random() * unsolvedCells.length
    );

    const { row, col } = unsolvedCells[randomIndex];
    const correctNumber = game.solution[row][col];

    const newBoard = board.map((boardRow) => [
      ...boardRow,
    ]);

    newBoard[row][col] = correctNumber;
    setBoard(newBoard);

    const copiedNotes = notes.map((noteRow) =>
      noteRow.map((cellNotes) => [...cellNotes])
    );

    const cleanedNotes =
      removeNumberFromRelatedNotes(
        copiedNotes,
        row,
        col,
        correctNumber
      );

    cleanedNotes[row][col] = [];

    if (autoNotesActive) {
      setNotes(buildAutoNotes(newBoard));
    } else {
      setNotes(cleanedNotes);
    }

    setSelectedCell({ row, col });
    setNotesMode(false);

    // Spend one hint only after a hint was successfully used.
    const nextHints = Math.max(0, hintsRemaining - 1);
    setHintsRemaining(nextHints);

    if (isBoardComplete(newBoard)) {
      completeGame();
      return;
    }

    if (nextHints === 0) {
      showRoast('Out of freebies dumbass.', 'hints');
    } else {
      const sectionsBefore = completedSectionCount(board);
      const sectionsAfter = completedSectionCount(newBoard);

      if (sectionsAfter > sectionsBefore) {
        showRoast(
          getRandomRoast(SECTION_ROASTS),
          'section'
        );
      }
    }
  }

  function eraseNumber() {
    if (!selectedCell || screen !== 'game') {
      return;
    }

    const { row, col } = selectedCell;

    if (game.puzzle[row][col] !== 0) {
      return;
    }

    if (board[row][col] !== 0) {
      const newBoard = board.map((boardRow) => [
        ...boardRow,
      ]);

      newBoard[row][col] = 0;
      setBoard(newBoard);

      if (autoNotesActive) {
        setNotes(buildAutoNotes(newBoard));
      }

      return;
    }

    if (autoNotesActive) {
      setNotes(buildAutoNotes(board));
      return;
    }

    const newNotes = notes.map((noteRow) =>
      noteRow.map((cellNotes) => [...cellNotes])
    );

    newNotes[row][col] = [];
    setNotes(newNotes);
  }

  // ========================================
  // HOME SCREEN
  // ========================================

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.homeContainer}>
        <View style={styles.homeContent}>
          <Image
            source={require('../../assets/images/sudoku-finger.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />

          <Text style={styles.homeTitle}>SUDOKU</Text>

          <Text style={styles.homeSubtitle}>
            Relax. Think. Solve.
          </Text>

          <View style={styles.homeCard}>
            {hasActiveGame && (
              <>
                <TouchableOpacity
                  style={styles.continueGameButton}
                  onPress={continueGame}
                >
                  <Text
                    style={styles.continueGameButtonText}
                  >
                    Continue Game
                  </Text>

                  <Text
                    style={styles.continueGameDetails}
                  >
                    {game.difficulty.toUpperCase()}
                    {'  •  '}
                    {formatTime(elapsedSeconds)}
                  </Text>
                </TouchableOpacity>

                <View style={styles.homeDivider}>
                  <View style={styles.homeDividerLine} />

                  <Text style={styles.homeDividerText}>
                    NEW GAME
                  </Text>

                  <View style={styles.homeDividerLine} />
                </View>
              </>
            )}

            <Text style={styles.chooseDifficultyTitle}>
              Choose Difficulty
            </Text>

            <View style={styles.homeDifficultyButtons}>
              {(
                ['easy', 'medium', 'hard'] as Difficulty[]
              ).map((difficulty) => {
                const selected =
                  selectedDifficulty === difficulty;

                return (
                  <TouchableOpacity
                    key={difficulty}
                    style={[
                      styles.homeDifficultyButton,
                      selected &&
                        styles.homeDifficultyButtonSelected,
                    ]}
                    onPress={() =>
                      setSelectedDifficulty(difficulty)
                    }
                  >
                    <Text
                      style={[
                        styles.homeDifficultyText,
                        selected &&
                          styles.homeDifficultyTextSelected,
                      ]}
                    >
                      {difficulty.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.startGameButton}
              onPress={() =>
                startGame(selectedDifficulty)
              }
            >
              <Text style={styles.startGameButtonText}>
                Start Game
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.homeBestTimesCard}>
            <Text style={styles.homeBestTimesTitle}>
              🏆 Best Times
            </Text>

            {(
              ['easy', 'medium', 'hard'] as Difficulty[]
            ).map((difficulty) => {
              const best = bestTimes[difficulty][0];

              return (
                <View
                  key={difficulty}
                  style={styles.homeBestTimeRow}
                >
                  <Text style={styles.homeBestDifficulty}>
                    {difficulty.toUpperCase()}
                  </Text>

                  <Text style={styles.homeBestTime}>
                    {best !== undefined
                      ? formatTime(best)
                      : '--:--'}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.homeFooter}>
            No ads • Unlimited games
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // VICTORY SCREEN
  // ========================================

  if (
    screen === 'victory' &&
    completionTime !== null
  ) {
    return (
      <SafeAreaView style={styles.victoryContainer}>
        <View style={styles.victoryContent}>
          <Text style={styles.victoryEmoji}>🖕</Text>

          <Text style={styles.victoryTitle}>
            Congratulations!
          </Text>

          <Text style={styles.victorySubtitle}>
            You solved the puzzle!
          </Text>

          <Text style={styles.victoryDifficulty}>
            {game.difficulty.toUpperCase()}
          </Text>

          <Text style={styles.victoryTime}>
            {formatTime(completionTime)}
          </Text>

          <Text style={styles.victoryTimeLabel}>
            COMPLETION TIME
          </Text>

          {newBestRank !== null && (
            <View style={styles.newRecordBox}>
              <Text style={styles.newRecordText}>
                🏆 New Top 5 Time!
              </Text>

              <Text style={styles.newRecordRank}>
                Rank #{newBestRank}
              </Text>
            </View>
          )}

          <View style={styles.bestTimesCard}>
            <Text style={styles.bestTimesTitle}>
              🏆 Fastest Times
            </Text>

            <Text style={styles.bestTimesDifficulty}>
              {game.difficulty.toUpperCase()}
            </Text>

            {bestTimes[game.difficulty].length === 0 ? (
              <Text style={styles.noTimesText}>
                No records yet
              </Text>
            ) : (
              bestTimes[game.difficulty].map(
                (time, index) => (
                  <View
                    key={`${time}-${index}`}
                    style={styles.bestTimeRow}
                  >
                    <Text style={styles.bestTimeRank}>
                      {index + 1}.
                    </Text>

                    <Text style={styles.bestTimeValue}>
                      {formatTime(time)}
                    </Text>
                  </View>
                )
              )
            )}
          </View>

          <TouchableOpacity
            style={styles.playAgainButton}
            onPress={() =>
              startGame(game.difficulty)
            }
          >
            <Text style={styles.playAgainText}>
              Play Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.victoryHomeButton}
            onPress={goHome}
          >
            <Text style={styles.victoryHomeText}>
              Home
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // GAME SCREEN
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.gameHeaderRow}>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={goHome}
          >
            <Text style={styles.homeButtonText}>
              ‹ Home
            </Text>
          </TouchableOpacity>

          <Text style={styles.title}>SUDOKU</Text>

          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.timer}>
          ⏱ {formatTime(elapsedSeconds)}
        </Text>

        <Text style={styles.gameDifficultyLabel}>
          {game.difficulty.toUpperCase()}
        </Text>
      </View>

      {roastMessage && (
        <View
          pointerEvents="none"
          style={[
            styles.roastToast,
            roastType === 'wrong' && styles.roastToastWrong,
            roastType === 'hints' && styles.roastToastHints,
          ]}
        >
          <Text style={styles.roastToastText}>
            {roastMessage}
          </Text>
        </View>
      )}

      <View style={styles.board}>
        {board.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const isSelected =
              selectedCell?.row === rowIndex &&
              selectedCell?.col === colIndex;

            const isGiven =
              game.puzzle[rowIndex][colIndex] !== 0;

            const isWrong =
              !isGiven &&
              value !== 0 &&
              value !==
                game.solution[rowIndex][colIndex];

            const cellNotes =
              notes[rowIndex][colIndex];

            return (
              <TouchableOpacity
                key={`${rowIndex}-${colIndex}`}
                style={[
                  styles.cell,
                  colIndex % 3 === 0 &&
                    styles.leftBoxBorder,
                  colIndex === 8 &&
                    styles.rightBoxBorder,
                  rowIndex % 3 === 0 &&
                    styles.topBoxBorder,
                  rowIndex === 8 &&
                    styles.bottomBoxBorder,
                  isSelected &&
                    styles.selectedCell,
                  isWrong &&
                    styles.wrongCell,
                ]}
                onPress={() =>
                  selectCell(rowIndex, colIndex)
                }
              >
                {value !== 0 ? (
                  <Text
                    style={[
                      styles.cellNumber,
                      isGiven
                        ? styles.givenNumber
                        : isWrong
                          ? styles.wrongNumber
                          : styles.playerNumber,
                    ]}
                  >
                    {value}
                  </Text>
                ) : (
                  <View style={styles.notesGrid}>
                    {[
                      1, 2, 3,
                      4, 5, 6,
                      7, 8, 9,
                    ].map((noteNumber) => (
                      <View
                        key={noteNumber}
                        style={styles.notePosition}
                      >
                        <Text style={styles.noteText}>
                          {cellNotes.includes(noteNumber)
                            ? noteNumber
                            : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.numberPad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(
          (number) => (
            <TouchableOpacity
              key={number}
              style={styles.numberButton}
              onPress={() => enterNumber(number)}
            >
              <Text style={styles.numberButtonText}>
                {number}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            notesMode &&
              styles.activeControlButton,
          ]}
          onPress={() =>
            setNotesMode(
              (currentMode) => !currentMode
            )
          }
        >
          <Text style={styles.controlIcon}>✎</Text>
          <Text
            style={[
              styles.controlText,
              notesMode &&
                styles.activeControlText,
            ]}
          >
            Notes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            autoNotesActive &&
              styles.activeControlButton,
          ]}
          onPress={toggleAutoNotes}
        >
          <Text style={styles.controlIcon}>✦</Text>
          <Text
            style={[
              styles.controlText,
              autoNotesActive &&
                styles.activeControlText,
            ]}
          >
            Auto Notes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            hintsRemaining === 0 &&
              styles.disabledControlButton,
          ]}
          onPress={useHint}
          disabled={hintsRemaining === 0}
        >
          <Text style={styles.controlIcon}>💡</Text>
          <Text
            style={[
              styles.controlText,
              hintsRemaining === 0 &&
                styles.disabledControlText,
            ]}
          >
            Hint ({hintsRemaining})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={eraseNumber}
        >
          <Text style={styles.controlIcon}>⌫</Text>
          <Text style={styles.controlText}>Erase</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.newGameButton}
        onPress={() => startGame(game.difficulty)}
      >
        <Text style={styles.newGameText}>
          New Game
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ========================================
  // HOME
  // ========================================

  homeContainer: {
    flex: 1,
    backgroundColor: '#050914',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  homeContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },

  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#2563eb',
  },

  homeTitle: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 7,
    color: '#f8fafc',
    marginTop: 14,
  },

  homeSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 3,
    marginBottom: 22,
  },

  homeCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  continueGameButton: {
    backgroundColor: '#123c2a',
    borderWidth: 1,
    borderColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 17,
  },

  continueGameButtonText: {
    color: '#f0fdf4',
    fontSize: 18,
    fontWeight: '800',
  },

  continueGameDetails: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
  },

  homeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  homeDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },

  homeDividerText: {
    marginHorizontal: 12,
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  chooseDifficultyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 16,
  },

  homeDifficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },

  homeDifficultyButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },

  homeDifficultyButtonSelected: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
  },

  homeDifficultyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
  },

  homeDifficultyTextSelected: {
    color: '#ffffff',
  },

  startGameButton: {
    marginTop: 18,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },

  startGameButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },

  homeBestTimesCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  homeBestTimesTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 10,
  },

  homeBestTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },

  homeBestDifficulty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94a3b8',
  },

  homeBestTime: {
    fontSize: 15,
    fontWeight: '800',
    color: '#60a5fa',
  },

  homeFooter: {
    marginTop: 15,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },

  // ========================================
  // GAME
  // ========================================

  container: {
    flex: 1,
    backgroundColor: '#050914',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  header: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },

  gameHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  homeButton: {
    width: 80,
    paddingVertical: 8,
  },

  homeButtonText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '700',
  },

  headerSpacer: {
    width: 80,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5,
    color: '#f8fafc',
  },

  timer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 5,
  },

  gameDifficultyLabel: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 3,
  },

  // ========================================
  // RUDE TOASTS
  // ========================================

  roastToast: {
    width: '94%',
    maxWidth: 360,
    minHeight: 48,
    backgroundColor: '#172554',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  roastToastWrong: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },

  roastToastHints: {
    backgroundColor: '#422006',
    borderColor: '#f59e0b',
  },

  roastToastText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ========================================
  // BOARD
  // ========================================

  board: {
    width: 360,
    height: 360,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0b1220',
    borderRadius: 4,
  },

  cell: {
    width: 40,
    height: 40,
    borderWidth: 0.5,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },

  leftBoxBorder: {
    borderLeftWidth: 2,
    borderLeftColor: '#94a3b8',
  },

  rightBoxBorder: {
    borderRightWidth: 2,
    borderRightColor: '#94a3b8',
  },

  topBoxBorder: {
    borderTopWidth: 2,
    borderTopColor: '#94a3b8',
  },

  bottomBoxBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#94a3b8',
  },

  selectedCell: {
    backgroundColor: '#1e3a5f',
  },

  wrongCell: {
    backgroundColor: '#451a1a',
  },

  cellNumber: {
    fontSize: 23,
  },

  givenNumber: {
    color: '#f8fafc',
    fontWeight: '700',
  },

  playerNumber: {
    color: '#60a5fa',
    fontWeight: '700',
  },

  wrongNumber: {
    color: '#f87171',
    fontWeight: '800',
  },

  notesGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  notePosition: {
    width: '33.333%',
    height: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // ========================================
  // NUMBER PAD
  // ========================================

  numberPad: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
    gap: 3,
  },

  numberButton: {
    width: 37,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },

  numberButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#60a5fa',
  },

  // ========================================
  // CONTROLS
  // ========================================

  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 18,
  },

  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  activeControlButton: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },

  controlIcon: {
    fontSize: 24,
    marginBottom: 4,
    color: '#f8fafc',
  },

  controlText: {
    fontSize: 12,
    color: '#94a3b8',
  },

  activeControlText: {
    color: '#60a5fa',
    fontWeight: '800',
  },

  disabledControlButton: {
    opacity: 0.35,
    backgroundColor: '#0b1220',
  },

  disabledControlText: {
    color: '#475569',
  },

  newGameButton: {
    marginTop: 22,
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },

  newGameText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },

  // ========================================
  // VICTORY
  // ========================================

  victoryContainer: {
    flex: 1,
    backgroundColor: '#050914',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },

  victoryContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },

  victoryEmoji: {
    fontSize: 72,
    marginBottom: 8,
  },

  victoryTitle: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },

  victorySubtitle: {
    color: '#94a3b8',
    fontSize: 18,
    marginTop: 8,
    textAlign: 'center',
  },

  victoryDifficulty: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 22,
  },

  victoryTime: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '900',
    marginTop: 5,
  },

  victoryTimeLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },

  newRecordBox: {
    marginTop: 18,
    backgroundColor: '#172554',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },

  newRecordText: {
    color: '#bfdbfe',
    fontSize: 16,
    fontWeight: '800',
  },

  newRecordRank: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },

  bestTimesCard: {
    width: '80%',
    maxWidth: 300,
    marginTop: 22,
    backgroundColor: '#0f172a',
    borderRadius: 15,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  bestTimesTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
  },

  bestTimesDifficulty: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },

  bestTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },

  bestTimeRank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
  },

  bestTimeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#60a5fa',
  },

  noTimesText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 10,
  },

  playAgainButton: {
    marginTop: 22,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },

  playAgainText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },

  victoryHomeButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },

  victoryHomeText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
});
