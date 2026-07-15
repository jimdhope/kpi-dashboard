import englishWords from 'an-array-of-english-words';

export const DAILY_WORD_ANSWERS = [
  'apple', 'beach', 'brain', 'bread', 'brick', 'chair', 'charm', 'cloud', 'crane', 'dance',
  'dream', 'earth', 'flame', 'fresh', 'grape', 'green', 'heart', 'house', 'light', 'magic',
  'melon', 'music', 'ocean', 'plant', 'pride', 'queen', 'quick', 'river', 'smile', 'solar',
  'sound', 'space', 'spark', 'stone', 'storm', 'sweet', 'table', 'tiger', 'train', 'water',
  'world',
] as const;

// Answers stay deliberately friendly and curated, while guesses may use the
// full English list. Filtering once at module load keeps per-guess lookup fast.
export const DAILY_WORD_ALLOWED = new Set<string>(
  (englishWords as string[])
    .map(word => word.toLowerCase())
    .filter(word => /^[a-z]{5}$/.test(word)),
);
