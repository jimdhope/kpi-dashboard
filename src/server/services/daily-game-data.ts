import answers from '../data/daily-word-answers.json';
import allowedGuesses from '../data/daily-word-allowed.json';

// These lists are bundled so gameplay never depends on a third-party network
// request. See src/server/data/DAILY_WORD_SOURCE.md for provenance.
export const DAILY_WORD_ANSWERS = answers as readonly string[];
export const DAILY_WORD_ALLOWED = new Set<string>(allowedGuesses);
