import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { DAILY_WORD_ALLOWED, DAILY_WORD_ANSWERS } from './daily-game-data';

export type DailyGameKey = 'higher-lower' | 'daily-word' | 'sudoku';
export type SudokuVariant = 'easy' | 'medium' | 'hard';
type JsonMap = Record<string, any>;

const SUDOKU_CLUES: Record<SudokuVariant, number> = { easy: 40, medium: 32, hard: 26 };

export function ukDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seedText: string) {
  let seed = hashSeed(seedText);
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeSudoku(seed: string, variant: SudokuVariant) {
  const random = rng(seed);
  const groups = shuffle([0, 1, 2], random);
  const rows = groups.flatMap(group => shuffle([0, 1, 2], random).map(row => group * 3 + row));
  const cols = shuffle([0, 1, 2], random).flatMap(group => shuffle([0, 1, 2], random).map(col => group * 3 + col));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const pattern = (r: number, c: number) => (r * 3 + Math.floor(r / 3) + c) % 9;
  const solution = rows.map(r => cols.map(c => nums[pattern(r, c)])).flat();
  const puzzle = [...solution];
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i), random);
  for (const position of positions) {
    if (puzzle.filter(Boolean).length <= SUDOKU_CLUES[variant]) break;
    const previous = puzzle[position];
    puzzle[position] = 0;
    if (countSudokuSolutions(puzzle, 2) !== 1) puzzle[position] = previous;
  }
  return { puzzle, solution };
}

function countSudokuSolutions(boardInput: number[], limit: number): number {
  const board = [...boardInput];
  let count = 0;
  const solve = () => {
    if (count >= limit) return;
    let best = -1;
    let candidates: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const possible = sudokuCandidates(board, i);
      if (possible.length === 0) return;
      if (best === -1 || possible.length < candidates.length) {
        best = i; candidates = possible;
        if (possible.length === 1) break;
      }
    }
    if (best === -1) { count++; return; }
    for (const value of candidates) {
      board[best] = value; solve(); board[best] = 0;
      if (count >= limit) return;
    }
  };
  solve();
  return count;
}

function sudokuCandidates(board: number[], index: number): number[] {
  const row = Math.floor(index / 9), col = index % 9;
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) { used.add(board[row * 9 + i]); used.add(board[i * 9 + col]); }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) used.add(board[r * 9 + c]);
  return [1,2,3,4,5,6,7,8,9].filter(value => !used.has(value));
}

async function ensureChallenge(gameKey: DailyGameKey, variant = 'default') {
  if (gameKey === 'sudoku') {
    if (!['easy', 'medium', 'hard'].includes(variant)) throw new Error('Invalid Sudoku difficulty');
  } else if (variant !== 'default') {
    throw new Error('Invalid game variant');
  }
  const challengeDate = ukDateKey();
  const existing = await prisma.dailyGameChallenge.findUnique({
    where: { gameKey_challengeDate_variant: { gameKey, challengeDate, variant } },
  });
  if (existing) return existing;

  let content: JsonMap, solution: JsonMap;
  if (gameKey === 'higher-lower') {
    const sequence = shuffle(Array.from({ length: 100 }, (_, i) => i + 1), rng(`${challengeDate}:higher-lower`)).slice(0, 20);
    content = { length: sequence.length }; solution = { sequence };
  } else if (gameKey === 'daily-word') {
    const answer = DAILY_WORD_ANSWERS[hashSeed(`${challengeDate}:daily-word`) % DAILY_WORD_ANSWERS.length];
    content = { length: 5, maxGuesses: 6 }; solution = { answer };
  } else {
    const sudokuVariant = variant as SudokuVariant;
    if (!SUDOKU_CLUES[sudokuVariant]) throw new Error('Invalid Sudoku difficulty');
    const generated = makeSudoku(`${challengeDate}:sudoku:${variant}`, sudokuVariant);
    content = { puzzle: generated.puzzle, difficulty: variant }; solution = { board: generated.solution };
  }

  try {
    return await prisma.dailyGameChallenge.create({ data: {
      gameKey, challengeDate, variant, content: content as Prisma.InputJsonValue, solution: solution as Prisma.InputJsonValue,
    }});
  } catch {
    return prisma.dailyGameChallenge.findUniqueOrThrow({ where: { gameKey_challengeDate_variant: { gameKey, challengeDate, variant } } });
  }
}

function initialState(challenge: { gameKey: string; content: unknown }) {
  const content = challenge.content as JsonMap;
  if (challenge.gameKey === 'higher-lower') return { index: 0, streak: 0 };
  if (challenge.gameKey === 'daily-word') return { rows: [] };
  return { board: [...content.puzzle], notes: {} };
}

function publicAttempt(challenge: any, attempt: any | null) {
  const content = challenge.content as JsonMap;
  const solution = challenge.solution as JsonMap;
  if (!attempt) return {
    status: 'not_started', challengeDate: challenge.challengeDate, variant: challenge.variant,
    content: challenge.gameKey === 'sudoku' ? { difficulty: content.difficulty } : content,
  };
  const state = attempt.state as JsonMap;
  const base = {
    status: attempt.status, challengeDate: challenge.challengeDate, variant: challenge.variant,
    startedAt: attempt.startedAt, completedAt: attempt.completedAt, durationMs: attempt.durationMs,
    score: attempt.score, guesses: attempt.guesses, mistakes: attempt.mistakes, hints: attempt.hints,
  };
  if (challenge.gameKey === 'higher-lower') return { ...base, content: { ...content, current: solution.sequence[state.index] }, state };
  if (challenge.gameKey === 'daily-word') return { ...base, content, state, answer: attempt.status !== 'in_progress' ? solution.answer : undefined };
  return { ...base, content, state };
}

async function leaderboard(challengeId: string, gameKey: DailyGameKey) {
  const attempts = await prisma.dailyGameAttempt.findMany({
    where: { challengeId, status: gameKey === 'higher-lower' ? { in: ['completed', 'failed'] } : 'completed' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const valid = attempts.filter(item => !item.user.email.toLowerCase().endsWith('@test.com'));
  valid.sort((a, b) => {
    if (gameKey === 'higher-lower') return b.score - a.score || (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity);
    if (gameKey === 'daily-word') return (a.guesses ?? 99) - (b.guesses ?? 99) || (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity);
    return (a.score || Infinity) - (b.score || Infinity);
  });
  return valid.slice(0, 10).map((item, index) => ({
    rank: index + 1, userId: item.user.id, name: item.user.name, score: item.score,
    guesses: item.guesses, durationMs: item.durationMs, mistakes: item.mistakes, hints: item.hints,
  }));
}

async function getAttempt(challengeId: string, userId: string) {
  return prisma.dailyGameAttempt.findUnique({ where: { challengeId_userId: { challengeId, userId } } });
}

export const dailyGameService = {
  async summaries(userId: string) {
    const specs: Array<[DailyGameKey, string]> = [
      ['higher-lower', 'default'], ['daily-word', 'default'],
      ['sudoku', 'easy'], ['sudoku', 'medium'], ['sudoku', 'hard'],
    ];
    return Promise.all(specs.map(async ([gameKey, variant]) => {
      const challenge = await ensureChallenge(gameKey, variant);
      const attempt = await getAttempt(challenge.id, userId);
      return { gameKey, variant, attempt: publicAttempt(challenge, attempt), leaderboard: await leaderboard(challenge.id, gameKey) };
    }));
  },

  async view(userId: string, gameKey: DailyGameKey, variant = 'default') {
    const challenge = await ensureChallenge(gameKey, variant);
    const attempt = await getAttempt(challenge.id, userId);
    return { attempt: publicAttempt(challenge, attempt), leaderboard: await leaderboard(challenge.id, gameKey) };
  },

  async act(userId: string, gameKey: DailyGameKey, variant: string, body: JsonMap) {
    const challenge = await ensureChallenge(gameKey, variant);
    let attempt = await getAttempt(challenge.id, userId);
    if (body.action === 'start') {
      if (!attempt) attempt = await prisma.dailyGameAttempt.create({ data: {
        challengeId: challenge.id, userId, state: initialState(challenge) as Prisma.InputJsonValue,
      }});
      return { attempt: publicAttempt(challenge, attempt), leaderboard: await leaderboard(challenge.id, gameKey) };
    }
    if (!attempt) throw new Error('Start the game first');
    if (attempt.status !== 'in_progress') throw new Error('This daily attempt is finished');
    if (gameKey === 'higher-lower') attempt = await this.higherLower(challenge, attempt, body);
    else if (gameKey === 'daily-word') attempt = await this.dailyWord(challenge, attempt, body);
    else attempt = await this.sudoku(challenge, attempt, body);
    return { attempt: publicAttempt(challenge, attempt), leaderboard: await leaderboard(challenge.id, gameKey) };
  },

  async higherLower(challenge: any, attempt: any, body: JsonMap) {
    if (body.action !== 'guess' || !['higher', 'lower'].includes(body.guess)) throw new Error('Invalid guess');
    const state = attempt.state as JsonMap, sequence = (challenge.solution as JsonMap).sequence as number[];
    const current = sequence[state.index], next = sequence[state.index + 1];
    if (next === undefined) throw new Error('No more numbers');
    const correct = body.guess === (next > current ? 'higher' : 'lower');
    const now = new Date(), durationMs = now.getTime() - attempt.startedAt.getTime();
    const nextState = { index: state.index + 1, streak: correct ? state.streak + 1 : state.streak };
    const finished = !correct || nextState.index === sequence.length - 1;
    return prisma.dailyGameAttempt.update({ where: { id: attempt.id }, data: {
      state: nextState, score: nextState.streak, status: finished ? (correct ? 'completed' : 'failed') : 'in_progress',
      durationMs: finished ? durationMs : null, completedAt: finished ? now : null,
      metrics: { lastNumber: next, correct } as Prisma.InputJsonValue,
    }});
  },

  async dailyWord(challenge: any, attempt: any, body: JsonMap) {
    if (body.action !== 'guess') throw new Error('Invalid action');
    const guess = String(body.guess || '').toLowerCase();
    if (!/^[a-z]{5}$/.test(guess) || !DAILY_WORD_ALLOWED.has(guess)) throw new Error('Enter a valid five-letter word');
    const answer = String((challenge.solution as JsonMap).answer);
    const marks = scoreWord(guess, answer), state = attempt.state as JsonMap;
    const rows = [...state.rows, { guess, marks }];
    const won = guess === answer, failed = rows.length >= 6 && !won;
    const now = new Date(), finished = won || failed;
    return prisma.dailyGameAttempt.update({ where: { id: attempt.id }, data: {
      state: { rows }, guesses: rows.length, score: won ? rows.length : 0,
      status: won ? 'completed' : failed ? 'failed' : 'in_progress',
      durationMs: finished ? now.getTime() - attempt.startedAt.getTime() : null,
      completedAt: finished ? now : null,
    }});
  },

  async sudoku(challenge: any, attempt: any, body: JsonMap) {
    const content = challenge.content as JsonMap, solution = (challenge.solution as JsonMap).board as number[];
    const state = attempt.state as JsonMap, board = [...state.board] as number[], notes = { ...(state.notes || {}) };
    let mistakes = attempt.mistakes, hints = attempt.hints;
    if (body.action === 'set') {
      const index = Number(body.index), value = Number(body.value);
      if (!Number.isInteger(index) || index < 0 || index > 80 || !Number.isInteger(value) || value < 0 || value > 9) throw new Error('Invalid cell value');
      if (content.puzzle[index] !== 0) throw new Error('Clue cells cannot be changed');
      if (value !== 0 && value !== solution[index]) mistakes++;
      board[index] = value; delete notes[index];
    } else if (body.action === 'note') {
      const index = Number(body.index), value = Number(body.value);
      if (content.puzzle[index] !== 0 || value < 1 || value > 9) throw new Error('Invalid note');
      const values = new Set<number>(notes[index] || []); values.has(value) ? values.delete(value) : values.add(value);
      notes[index] = [...values].sort();
    } else if (body.action === 'hint') {
      const empty = board.map((value, index) => value !== solution[index] && content.puzzle[index] === 0 ? index : -1).filter(index => index >= 0);
      if (!empty.length) throw new Error('No cells available for a hint');
      const index = empty[hashSeed(`${attempt.id}:${hints}`) % empty.length];
      board[index] = solution[index]; delete notes[index]; hints++;
    } else throw new Error('Invalid action');
    const completed = board.every((value, index) => value === solution[index]);
    const now = new Date(), durationMs = completed ? now.getTime() - attempt.startedAt.getTime() : null;
    const adjusted = completed ? durationMs! + mistakes * 30000 + hints * 60000 : 0;
    return prisma.dailyGameAttempt.update({ where: { id: attempt.id }, data: {
      state: { board, notes }, mistakes, hints, status: completed ? 'completed' : 'in_progress',
      score: adjusted, durationMs, completedAt: completed ? now : null,
    }});
  },
};

function scoreWord(guess: string, answer: string): string[] {
  const marks = Array(5).fill('absent');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === 'correct') continue;
    if ((remaining[guess[i]] || 0) > 0) { marks[i] = 'present'; remaining[guess[i]]--; }
  }
  return marks;
}
