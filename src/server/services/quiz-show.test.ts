import test from "node:test";
import assert from "node:assert/strict";
import { quizShowScoring } from "./quiz-show-service";
import { questionSchema } from "./quiz-show-schemas";

test("multiple-correct answers require an exact set", () => {
  assert.equal(quizShowScoring.isExactSet(["a", "b"], ["b", "a"]), true);
  assert.equal(quizShowScoring.isExactSet(["a"], ["a", "b"]), false);
  assert.equal(quizShowScoring.isExactSet(["a", "a"], ["a"]), true);
});

test("correct answer tiers award 1000, 750, and 500 points", () => {
  assert.deepEqual([0, 1, 2].map((rank) => quizShowScoring.pointsForRank(rank, 3)), [1000, 750, 500]);
  assert.deepEqual([0, 1, 2, 3].map((rank) => quizShowScoring.pointsForRank(rank, 4)), [1000, 1000, 750, 500]);
  assert.equal(quizShowScoring.pointsForRank(0, 1), 1000);
});

test("question validation enforces exact correct-answer rules", () => {
  const base = { text: "Pick one", type: "singleChoice" as const, options: [{ text: "A", position: 0, isCorrect: true }, { text: "B", position: 1, isCorrect: false }] };
  assert.equal(questionSchema.safeParse(base).success, true);
  assert.equal(questionSchema.safeParse({ ...base, options: base.options.map((option) => ({ ...option, isCorrect: true })) }).success, false);
  assert.equal(questionSchema.safeParse({ ...base, type: "multipleChoice", options: base.options.map((option) => ({ ...option, isCorrect: true })) }).success, true);
  assert.equal(questionSchema.safeParse({ ...base, type: "trueFalse" }).success, true);
});
