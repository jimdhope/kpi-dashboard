import "server-only";

import { randomInt } from "node:crypto";
import { Prisma, QuizShowPhase, QuizShowQuestionType, QuizShowQuizMode } from "@prisma/client";
import { prisma } from "@/server/db/client";

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 100;
const DEFAULT_TIMER_SECONDS = 30;
const MIN_TIMER_SECONDS = 10;
const MAX_TIMER_SECONDS = 120;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type QuizShowQuestionInput = {
  title?: string | null;
  text: string;
  category?: string | null;
  internalNotes?: string | null;
  type: QuizShowQuestionType;
  isActive?: boolean;
  mediaUrl?: string | null;
  mediaOriginalName?: string | null;
  mediaContentType?: string | null;
  mediaSize?: number | null;
  options: Array<{ id?: string; text: string; position: number; isCorrect: boolean }>;
};

export type QuizShowQuizInput = {
  title: string;
  description?: string | null;
  mode: QuizShowQuizMode;
  isActive?: boolean;
  questionCount?: number | null;
  questionIds: string[];
};

type StateOptions = { admin?: boolean };

function makeRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

function timerSeconds(value?: number | null) {
  return Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, value ?? DEFAULT_TIMER_SECONDS));
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function isExactSet(left: string[], right: string[]) {
  const a = uniqueStrings(left).sort();
  const b = uniqueStrings(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function pointsForRank(rank: number, count: number) {
  if (count <= 1 || rank < Math.ceil(count / 3)) return 1000;
  if (rank < Math.ceil((count * 2) / 3)) return 750;
  return 500;
}

function publicOption(option: { id: string; text: string; position: number; isCorrect: boolean }, reveal: boolean) {
  return { id: option.id, text: option.text, position: option.position, ...(reveal ? { isCorrect: option.isCorrect } : {}) };
}

async function loadRoom(code: string) {
  return prisma.quizShowRoom.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, name: true, email: true } },
      quiz: { select: { id: true, title: true, mode: true } },
      questions: {
        orderBy: { position: "asc" },
        include: { question: { include: { options: { orderBy: { position: "asc" } } } }, answers: true },
      },
      participants: { include: { user: { select: { id: true, name: true, email: true } }, answers: true }, orderBy: { displayOrder: "asc" } },
    },
  });
}

type RoomBundle = Awaited<ReturnType<typeof loadRoom>>;

function ensureRoom(room: RoomBundle): asserts room is NonNullable<RoomBundle> {
  if (!room) throw new Error("Room not found.");
}

function ensureMember(room: NonNullable<RoomBundle>, userId: string) {
  const participant = room.participants.find((item) => item.userId === userId);
  if (!participant && room.hostId !== userId) throw new Error("Forbidden");
  return participant ?? null;
}

function currentRoomQuestion(room: NonNullable<RoomBundle>) {
  return room.questions.find((item) => item.position === room.currentQuestion) ?? null;
}

function answerView(room: NonNullable<RoomBundle>, reveal: boolean) {
  const question = currentRoomQuestion(room);
  if (!question) return null;
  const answers = question.answers;
  const distribution = question.question.options.map((option) => ({
    optionId: option.id,
    count: answers.filter((answer) => Array.isArray(answer.selectedOptionIds) && (answer.selectedOptionIds as string[]).includes(option.id)).length,
  }));
  return {
    responseCount: answers.length,
    distribution,
    ...(reveal ? {
      answers: answers.map((answer) => ({ participantId: answer.participantId, selectedOptionIds: answer.selectedOptionIds, isCorrect: answer.isCorrect, points: answer.points, responseMs: answer.responseMs })),
    } : {}),
  };
}

function buildState(room: NonNullable<RoomBundle>, viewerUserId: string, options: StateOptions = {}) {
  const participant = room.participants.find((item) => item.userId === viewerUserId) ?? null;
  const isHost = room.hostId === viewerUserId;
  const reveal = room.phase === QuizShowPhase.reveal || room.phase === QuizShowPhase.complete;
  const current = currentRoomQuestion(room);
  const currentAnswer = participant && current ? current.answers.find((answer) => answer.participantId === participant.id) : null;
  return {
    room: {
      id: room.id,
      code: room.code,
      phase: room.phase,
      currentQuestion: room.currentQuestion,
      totalQuestions: room.questions.length,
      shuffleQuestions: room.shuffleQuestions,
      questionStartedAt: room.questionStartedAt?.toISOString() ?? null,
      answerDeadlineAt: room.answerDeadlineAt?.toISOString() ?? null,
      startedAt: room.startedAt?.toISOString() ?? null,
      completedAt: room.completedAt?.toISOString() ?? null,
      host: room.host,
      quiz: room.quiz,
    },
    viewer: { userId: viewerUserId, isHost, isParticipant: Boolean(participant), hasAnswered: Boolean(currentAnswer) },
    participants: room.participants.map((item) => ({ id: item.id, userId: item.userId, name: item.user.name, score: item.score, cumulativeResponseMs: item.cumulativeResponseMs, joinedAt: item.joinedAt.toISOString(), isHost: item.userId === room.hostId })),
    question: current ? {
      id: current.id,
      position: current.position,
      text: current.question.text,
      type: current.question.type,
      mediaUrl: current.question.mediaUrl,
      mediaOriginalName: current.question.mediaOriginalName,
      mediaContentType: current.question.mediaContentType,
      options: current.question.options.map((option) => publicOption(option, reveal)),
      ...(reveal ? { correctOptionIds: current.question.options.filter((option) => option.isCorrect).map((option) => option.id) } : {}),
    } : null,
    answer: currentAnswer ? { selectedOptionIds: currentAnswer.selectedOptionIds, isCorrect: reveal ? currentAnswer.isCorrect : undefined, points: reveal ? currentAnswer.points : undefined } : null,
    results: reveal ? answerView(room, true) : answerView(room, false),
    leaderboard: [...room.participants].sort((a, b) => b.score - a.score || a.cumulativeResponseMs - b.cumulativeResponseMs || a.displayOrder - b.displayOrder).map((item) => ({ name: item.user.name, score: item.score, cumulativeResponseMs: item.cumulativeResponseMs, joinedAt: item.joinedAt.toISOString() })),
    ...(options.admin ? { allAnswers: room.questions.flatMap((item) => item.answers.map((answer) => ({ id: answer.id, questionId: item.id, participantId: answer.participantId, selectedOptionIds: answer.selectedOptionIds, isCorrect: answer.isCorrect, points: answer.points, responseMs: answer.responseMs }))) } : {}),
  };
}

async function recalculateQuestionScores(tx: Prisma.TransactionClient, roomQuestionId: string) {
  const answers = await tx.quizShowAnswer.findMany({ where: { roomQuestionId }, orderBy: { responseMs: "asc" } });
  const correct = answers.filter((answer) => answer.isCorrect);
  const points = new Map(correct.map((answer, index) => [answer.id, pointsForRank(index, correct.length)]));
  await Promise.all(answers.map((answer) => tx.quizShowAnswer.update({ where: { id: answer.id }, data: { points: points.get(answer.id) ?? 0 } })));
}

async function recalculateParticipantScores(tx: Prisma.TransactionClient, roomId: string) {
  const participants = await tx.quizShowParticipant.findMany({ where: { roomId }, include: { answers: true } });
  await Promise.all(participants.map((participant) => tx.quizShowParticipant.update({ where: { id: participant.id }, data: { score: participant.answers.reduce((sum, answer) => sum + answer.points, 0), cumulativeResponseMs: participant.answers.reduce((sum, answer) => sum + answer.responseMs, 0) } })));
}

async function writeAudit(userId: string, action: string, entityId: string, payloadJson: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { userId, action, entityType: "QuizShow", entityId, payloadJson } });
}

class QuizShowSseService {
  private streams = new Map<string, Set<(event: string, data: string) => void>>();

  subscribe(code: string, send: (event: string, data: string) => void) {
    const listeners = this.streams.get(code) ?? new Set();
    listeners.add(send);
    this.streams.set(code, listeners);
    return () => { listeners.delete(send); if (!listeners.size) this.streams.delete(code); };
  }

  broadcast(code: string, event = "room-state") {
    for (const send of this.streams.get(code) ?? []) send(event, JSON.stringify({ code, event, at: new Date().toISOString() }));
  }
}

export const quizShowSseService = new QuizShowSseService();

export const quizShowService = {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_TIMER_SECONDS,
  MIN_TIMER_SECONDS,
  MAX_TIMER_SECONDS,

  async listQuestions() {
    return prisma.quizShowQuestion.findMany({ include: { options: { orderBy: { position: "asc" } } }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  },

  async createQuestion(userId: string, input: QuizShowQuestionInput) {
    const question = await prisma.quizShowQuestion.create({ data: { title: input.title ?? null, text: input.text, category: input.category ?? null, internalNotes: input.internalNotes ?? null, type: input.type, isActive: input.isActive ?? true, mediaUrl: input.mediaUrl ?? null, mediaOriginalName: input.mediaOriginalName ?? null, mediaContentType: input.mediaContentType ?? null, mediaSize: input.mediaSize ?? null, createdById: userId, options: { create: input.options.map((option) => ({ text: option.text, position: option.position, isCorrect: option.isCorrect })) } }, include: { options: { orderBy: { position: "asc" } } } });
    await writeAudit(userId, "quiz_show.question.created", question.id, { type: question.type, optionCount: question.options.length });
    return question;
  },

  async updateQuestion(userId: string, id: string, input: QuizShowQuestionInput) {
    const question = await prisma.$transaction(async (tx) => {
      await tx.quizShowAnswerOption.deleteMany({ where: { questionId: id } });
      return tx.quizShowQuestion.update({ where: { id }, data: { title: input.title ?? null, text: input.text, category: input.category ?? null, internalNotes: input.internalNotes ?? null, type: input.type, isActive: input.isActive ?? true, mediaUrl: input.mediaUrl ?? null, mediaOriginalName: input.mediaOriginalName ?? null, mediaContentType: input.mediaContentType ?? null, mediaSize: input.mediaSize ?? null, options: { create: input.options.map((option) => ({ text: option.text, position: option.position, isCorrect: option.isCorrect })) } }, include: { options: { orderBy: { position: "asc" } } } });
    });
    await writeAudit(userId, "quiz_show.question.updated", id, { type: question.type, optionCount: question.options.length });
    return question;
  },

  async deleteQuestion(userId: string, id: string) {
    const question = await prisma.quizShowQuestion.delete({ where: { id } });
    await writeAudit(userId, "quiz_show.question.deleted", id, { text: question.text });
    return question;
  },

  async listQuizzes() {
    return prisma.quizShowQuiz.findMany({ include: { questions: { include: { question: { select: { id: true, text: true, type: true, isActive: true } } }, orderBy: { position: "asc" } } }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  },

  async createQuiz(userId: string, input: QuizShowQuizInput) {
    const quiz = await prisma.quizShowQuiz.create({ data: { title: input.title, description: input.description ?? null, mode: input.mode, isActive: input.isActive ?? true, questionCount: input.questionCount ?? null, createdById: userId, questions: { create: input.questionIds.map((questionId, position) => ({ questionId, position })) } }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
    await writeAudit(userId, "quiz_show.quiz.created", quiz.id, { title: quiz.title, mode: quiz.mode, questionCount: quiz.questions.length });
    return quiz;
  },

  async updateQuiz(userId: string, id: string, input: QuizShowQuizInput) {
    const quiz = await prisma.$transaction(async (tx) => {
      await tx.quizShowQuizQuestion.deleteMany({ where: { quizId: id } });
      return tx.quizShowQuiz.update({ where: { id }, data: { title: input.title, description: input.description ?? null, mode: input.mode, isActive: input.isActive ?? true, questionCount: input.questionCount ?? null, questions: { create: input.questionIds.map((questionId, position) => ({ questionId, position })) } }, include: { questions: { include: { question: true }, orderBy: { position: "asc" } } } });
    });
    await writeAudit(userId, "quiz_show.quiz.updated", id, { title: quiz.title, mode: quiz.mode, questionCount: quiz.questions.length });
    return quiz;
  },

  async deleteQuiz(userId: string, id: string) {
    const quiz = await prisma.quizShowQuiz.delete({ where: { id } });
    await writeAudit(userId, "quiz_show.quiz.deleted", id, { title: quiz.title });
    return quiz;
  },

  async getRoomState(userId: string, code: string) {
    const room = await loadRoom(code.toUpperCase());
    ensureRoom(room);
    ensureMember(room, userId);
    return buildState(room, userId);
  },

  async getAdminRoom(code: string) {
    const room = await loadRoom(code.toUpperCase());
    if (!room) return null;
    return buildState(room, room.hostId, { admin: true });
  },

  async getAdminRooms() {
    const rooms = await prisma.quizShowRoom.findMany({ select: { code: true }, orderBy: { updatedAt: "desc" } });
    const states = await Promise.all(rooms.map((room) => this.getAdminRoom(room.code)));
    return states.filter((state): state is NonNullable<typeof state> => Boolean(state));
  },

  async deleteRoom(userId: string, code: string) {
    const room = await loadRoom(code.toUpperCase());
    ensureRoom(room);
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { userId, action: "quiz_show.room.deleted", entityType: "QuizShowRoom", entityId: room.id, payloadJson: { roomCode: room.code, phase: room.phase, participantCount: room.participants.length } } });
      await tx.quizShowRoom.delete({ where: { id: room.id } });
    });
    quizShowSseService.broadcast(room.code, "room-deleted");
  },

  async createRoom(userId: string, quizId: string, shuffleQuestions: boolean) {
    const quiz = await prisma.quizShowQuiz.findFirst({ where: { id: quizId, isActive: true }, include: { questions: { where: { question: { isActive: true } }, include: { question: { include: { options: true } } }, orderBy: { position: "asc" } } } });
    if (!quiz) throw new Error("Quiz not found or inactive.");
    let questions = quiz.questions.map((item) => item.question);
    if (quiz.mode === QuizShowQuizMode.random && !questions.length) questions = await prisma.quizShowQuestion.findMany({ where: { isActive: true }, include: { options: true }, orderBy: { createdAt: "asc" } });
    if (quiz.mode === QuizShowQuizMode.random) questions = questions.sort(() => Math.random() - 0.5).slice(0, quiz.questionCount ?? questions.length);
    if (!questions.length) throw new Error("This quiz has no active questions.");
    if (shuffleQuestions) questions = questions.sort(() => Math.random() - 0.5);
    let code = makeRoomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await prisma.quizShowRoom.findUnique({ where: { code } }))) break;
      code = makeRoomCode();
    }
    const room = await prisma.quizShowRoom.create({ data: { code, hostId: userId, quizId, shuffleQuestions, questions: { create: questions.map((question, position) => ({ questionId: question.id, position })) }, participants: { create: { userId, displayOrder: 1 } } } });
    await writeAudit(userId, "quiz_show.room.created", room.id, { roomCode: room.code, quizId, questionCount: questions.length });
    quizShowSseService.broadcast(room.code, "room-state");
    return this.getRoomState(userId, room.code);
  },

  async joinRoom(userId: string, code: string) {
    const room = await loadRoom(code.toUpperCase());
    ensureRoom(room);
    const existing = room.participants.find((item) => item.userId === userId);
    if (existing || room.hostId === userId) return buildState(room, userId);
    if (room.phase !== QuizShowPhase.lobby) throw new Error("This room has already started.");
    if (room.participants.length >= MAX_PLAYERS) throw new Error("This room is full.");
    await prisma.quizShowParticipant.create({ data: { roomId: room.id, userId, displayOrder: room.participants.length + 1 } });
    quizShowSseService.broadcast(room.code, "room-state");
    return this.getRoomState(userId, room.code);
  },

  async startQuestion(userId: string, code: string, timer?: number) {
    const room = await loadRoom(code.toUpperCase());
    ensureRoom(room);
    if (room.hostId !== userId) throw new Error("Only the host can control this room.");
    if (room.phase !== QuizShowPhase.lobby && room.phase !== QuizShowPhase.reveal) throw new Error("The room is not ready for the next question.");
    const nextPosition = room.phase === QuizShowPhase.lobby ? 0 : room.currentQuestion + 1;
    if (!room.questions.some((item) => item.position === nextPosition)) {
      await prisma.quizShowRoom.update({ where: { id: room.id }, data: { phase: QuizShowPhase.complete, completedAt: new Date(), questionStartedAt: null, answerDeadlineAt: null } });
      await writeAudit(userId, "quiz_show.room.completed", room.id, { roomCode: room.code });
      quizShowSseService.broadcast(room.code, "complete");
      return this.getRoomState(userId, room.code);
    }
    const startedAt = new Date();
    await prisma.quizShowRoom.update({ where: { id: room.id }, data: { phase: QuizShowPhase.answering, currentQuestion: nextPosition, questionStartedAt: startedAt, answerDeadlineAt: new Date(startedAt.getTime() + timerSeconds(timer) * 1000), startedAt: room.startedAt ?? startedAt } });
    await writeAudit(userId, "quiz_show.question.started", room.id, { roomCode: room.code, position: nextPosition, timerSeconds: timerSeconds(timer) });
    quizShowSseService.broadcast(room.code, "question-started");
    return this.getRoomState(userId, room.code);
  },

  async revealQuestion(userId: string, code: string) {
    const room = await loadRoom(code.toUpperCase());
    ensureRoom(room);
    if (room.hostId !== userId) throw new Error("Only the host can control this room.");
    if (room.phase !== QuizShowPhase.answering) throw new Error("Answers are already closed.");
    const question = currentRoomQuestion(room);
    if (!question) throw new Error("Current question not found.");
    await prisma.$transaction(async (tx) => { await recalculateQuestionScores(tx, question.id); await recalculateParticipantScores(tx, room.id); await tx.quizShowRoom.update({ where: { id: room.id }, data: { phase: QuizShowPhase.reveal } }); });
    await writeAudit(userId, "quiz_show.question.revealed", room.id, { roomCode: room.code, position: room.currentQuestion });
    quizShowSseService.broadcast(room.code, "reveal");
    return this.getRoomState(userId, room.code);
  },

  async answer(userId: string, code: string, selectedOptionIds: string[]) {
    const room = await loadRoom(code.toUpperCase());
    ensureRoom(room);
    const participant = ensureMember(room, userId);
    if (!participant) throw new Error("You are not in this room.");
    if (room.phase !== QuizShowPhase.answering) throw new Error("Answers are closed.");
    if (room.answerDeadlineAt && room.answerDeadlineAt.getTime() <= Date.now()) throw new Error("Time has expired.");
    const roomQuestion = currentRoomQuestion(room);
    if (!roomQuestion) throw new Error("Current question not found.");
    if (roomQuestion.answers.some((item) => item.participantId === participant.id)) throw new Error("You have already answered this question.");
    const validIds = roomQuestion.question.options.map((option) => option.id);
    const selected = uniqueStrings(selectedOptionIds);
    if (!selected.length || selected.some((id) => !validIds.includes(id))) throw new Error("Choose a valid answer.");
    const correct = roomQuestion.question.options.filter((option) => option.isCorrect).map((option) => option.id);
    const isCorrect = isExactSet(selected, correct);
    const responseMs = Math.max(0, Date.now() - (room.questionStartedAt?.getTime() ?? Date.now()));
    await prisma.quizShowAnswer.create({ data: { roomId: room.id, roomQuestionId: roomQuestion.id, participantId: participant.id, selectedOptionIds: selected, isCorrect, responseMs } });
    quizShowSseService.broadcast(room.code, "answer");
    return this.getRoomState(userId, room.code);
  },

  async getActiveRooms() {
    return prisma.quizShowRoom.findMany({ where: { phase: { not: QuizShowPhase.complete } }, select: { code: true, phase: true, currentQuestion: true, createdAt: true, _count: { select: { participants: true } } }, orderBy: { createdAt: "desc" } });
  },
};

export const quizShowScoring = { isExactSet, pointsForRank };
export { buildState, loadRoom, timerSeconds };
