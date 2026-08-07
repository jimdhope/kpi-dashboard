import { z } from "zod";
import { QuizShowQuestionType, QuizShowQuizMode } from "@prisma/client";

export const questionSchema = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  text: z.string().trim().min(3).max(1_000),
  category: z.string().trim().max(80).nullable().optional(),
  internalNotes: z.string().trim().max(1_000).nullable().optional(),
  type: z.nativeEnum(QuizShowQuestionType),
  isActive: z.boolean().optional(),
  mediaUrl: z.string().trim().max(500).nullable().optional(),
  mediaOriginalName: z.string().trim().max(180).nullable().optional(),
  mediaContentType: z.string().trim().max(100).nullable().optional(),
  mediaSize: z.number().int().min(0).max(10 * 1024 * 1024).nullable().optional(),
  options: z.array(z.object({ text: z.string().trim().min(1).max(240), position: z.number().int().min(0).max(5), isCorrect: z.boolean() })).min(2).max(6),
}).superRefine((value, ctx) => {
  if (new Set(value.options.map((option) => option.position)).size !== value.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Option positions must be unique." });
  const correct = value.options.filter((option) => option.isCorrect).length;
  if (value.type === QuizShowQuestionType.multipleChoice ? correct < 2 : correct !== 1) ctx.addIssue({ code: "custom", path: ["options"], message: value.type === QuizShowQuestionType.multipleChoice ? "Choose at least two correct answers." : "Choose exactly one correct answer." });
  if (value.type === QuizShowQuestionType.trueFalse && value.options.length !== 2) ctx.addIssue({ code: "custom", path: ["options"], message: "True/false questions require exactly two options." });
});

export const quizSchema = z.object({ title: z.string().trim().min(2).max(120), description: z.string().trim().max(500).nullable().optional(), mode: z.nativeEnum(QuizShowQuizMode), isActive: z.boolean().optional(), questionCount: z.number().int().min(1).max(100).nullable().optional(), questionIds: z.array(z.string().min(1)).max(100) }).superRefine((value, ctx) => { if (value.mode === QuizShowQuizMode.saved && value.questionIds.length < 1) ctx.addIssue({ code: "custom", path: ["questionIds"], message: "Saved quizzes require at least one question." }); });
