import "server-only";

import { MemeMatchPhase, Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { giphyService } from "@/server/services/giphy-service";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 12;
const DEFAULT_TOTAL_ROUNDS = 3;

type JsonObject = Record<string, any>;

export type MemeMatchParticipantView = {
  id: string;
  userId: string;
  displayName: string;
  anonymousLabel: string;
  score: number;
  joinedAt: string;
  isHost: boolean;
};

export type MemeMatchSubmissionView = {
  id: string;
  submissionId: string;
  roundNumber: number;
  gifId: string;
  gifUrl: string;
  gifTitle: string | null;
  previewUrl: string | null;
  caption: string;
  anonymousLabel: string;
  authorName?: string;
  voteCount: number;
  createdAt: string;
};

export type MemeMatchRoundView = {
  id: string;
  roundNumber: number;
  prompt: { id: string; text: string; category: string | null };
  startedAt: string;
  advancedToVoteAt: string | null;
  revealedAt: string | null;
  completedAt: string | null;
};

export type MemeMatchRoomState = {
  room: {
    id: string;
    code: string;
    phase: MemeMatchPhase;
    currentRound: number;
    totalRounds: number;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    host: { id: string; name: string; email: string };
  };
  viewer: {
    userId: string;
    isHost: boolean;
    isParticipant: boolean;
    canStart: boolean;
    canAdvance: boolean;
    canSubmit: boolean;
    canVote: boolean;
  };
  prompt: { id: string; text: string; category: string | null } | null;
  participants: MemeMatchParticipantView[];
  rounds: MemeMatchRoundView[];
  submissions: MemeMatchSubmissionView[];
  leaderboard: Array<{ userId: string; name: string; score: number; joinedAt: string }>;
  votesCastByViewer: string[];
  votesCast: number;
};

export type MemeMatchActiveRoomView = {
  code: string;
  phase: MemeMatchPhase;
  currentRound: number;
  participantCount: number;
};

export type MemeMatchAdminRoomView = MemeMatchActiveRoomView & {
  id: string;
  host: { id: string; name: string; email: string };
  totalRounds: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  participants: MemeMatchParticipantView[];
  rounds: MemeMatchRoundView[];
  submissions: MemeMatchSubmissionView[];
  votes: Array<{ id: string; roundNumber: number; voterName: string; submissionId: string; participantId: string; createdAt: string }>;
  leaderboard: Array<{ userId: string; name: string; score: number; joinedAt: string }>;
};

export type MemeMatchCleanupView = {
  id: string;
  roomCode: string;
  completedAt: string | null;
  participantCount: number;
  cleanedAt: string;
};

type RoomBundle = Awaited<ReturnType<typeof loadRoomBundle>>;

function makeRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

function mapPhase(value: unknown): MemeMatchPhase {
  if (value === "lobby" || value === "submitting" || value === "voting" || value === "reveal" || value === "complete") {
    return value;
  }
  return MemeMatchPhase.lobby;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toPrompt(row: { id: string; text: string; category: string | null }) {
  return { id: row.id, text: row.text, category: row.category };
}

async function loadRoomBundle(code: string) {
  const room = await prisma.memeMatchRoom.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, name: true, email: true } },
      activePrompt: { select: { id: true, text: true, category: true } },
      participants: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: [{ displayOrder: "asc" }] },
      rounds: {
        include: {
          prompt: { select: { id: true, text: true, category: true } },
          submissions: {
            include: {
              participant: { include: { user: { select: { id: true, name: true, email: true } } } },
              votes: true,
            },
          },
          votes: true,
        },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  return room;
}

function displayLabel(index: number) {
  return `Anonymous Player ${index + 1}`;
}

function buildState(room: NonNullable<RoomBundle>, viewerUserId: string): MemeMatchRoomState {
  const participantMap = new Map(room.participants.map((participant) => [participant.userId, participant]));
  const submissions = room.rounds.flatMap((round) =>
    round.submissions.map((submission) => ({
      id: submission.id,
      submissionId: submission.id,
      roundNumber: round.roundNumber,
      gifId: submission.gifId,
      gifUrl: submission.gifUrl,
      gifTitle: submission.gifTitle,
      previewUrl: submission.previewUrl,
      caption: submission.caption,
      anonymousLabel: displayLabel(submission.participant.displayOrder - 1),
      authorName:
        room.phase === MemeMatchPhase.reveal || room.phase === MemeMatchPhase.complete
          ? submission.participant.user.name
          : undefined,
      voteCount: submission.votes.length,
      createdAt: submission.submittedAt.toISOString(),
    }))
  );
  const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRound) ?? null;
  const viewerParticipant = participantMap.get(viewerUserId) ?? null;
  const isHost = room.hostId === viewerUserId;
  const canStart = isHost && room.phase === MemeMatchPhase.lobby && room.participants.length >= MIN_PLAYERS;
  const canAdvance = isHost && (room.phase === MemeMatchPhase.submitting || room.phase === MemeMatchPhase.voting || room.phase === MemeMatchPhase.reveal);
  const canSubmit = Boolean(viewerParticipant) && room.phase === MemeMatchPhase.submitting;
  const canVote = Boolean(viewerParticipant) && room.phase === MemeMatchPhase.voting;

  const submissionsForRound = currentRound
    ? currentRound.submissions.map((submission) => ({
        id: submission.id,
        submissionId: submission.id,
        roundNumber: currentRound.roundNumber,
        gifId: submission.gifId,
        gifUrl: submission.gifUrl,
        gifTitle: submission.gifTitle,
        previewUrl: submission.previewUrl,
        caption: submission.caption,
        anonymousLabel: displayLabel(submission.participant.displayOrder - 1),
        authorName:
          room.phase === MemeMatchPhase.reveal || room.phase === MemeMatchPhase.complete
            ? submission.participant.user.name
            : undefined,
        voteCount: submission.votes.length,
        createdAt: submission.submittedAt.toISOString(),
      }))
    : [];

  return {
    room: {
      id: room.id,
      code: room.code,
      phase: room.phase,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      createdAt: room.createdAt.toISOString(),
      startedAt: toIso(room.startedAt),
      completedAt: toIso(room.completedAt),
      host: room.host,
    },
    viewer: {
      userId: viewerUserId,
      isHost,
      isParticipant: Boolean(viewerParticipant),
      canStart,
      canAdvance,
      canSubmit,
      canVote,
    },
    prompt: currentRound ? toPrompt(currentRound.prompt) : room.activePrompt ? toPrompt(room.activePrompt) : null,
    participants: room.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      displayName: participant.user.name,
      anonymousLabel: displayLabel(participant.displayOrder - 1),
      score: participant.score,
      joinedAt: participant.joinedAt.toISOString(),
      isHost: participant.userId === room.hostId,
    })),
    rounds: room.rounds.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      prompt: toPrompt(round.prompt),
      startedAt: round.startedAt.toISOString(),
      advancedToVoteAt: toIso(round.advancedToVoteAt),
      revealedAt: toIso(round.revealedAt),
      completedAt: toIso(round.completedAt),
    })),
    submissions: submissionsForRound,
    leaderboard: [...room.participants]
      .sort((a, b) => b.score - a.score || a.displayOrder - b.displayOrder)
      .map((participant) => ({
        userId: participant.userId,
        name: participant.user.name,
        score: participant.score,
        joinedAt: participant.joinedAt.toISOString(),
      })),
    votesCastByViewer: room.rounds.flatMap((round) =>
      round.votes.filter((vote) => vote.voterId === participantMap.get(viewerUserId)?.id).map((vote) => vote.submissionId)
    ),
    votesCast: currentRound?.votes.length ?? 0,
  };
}

function ensureAccessibleRoom(room: RoomBundle, userId: string) {
  if (!room) throw new Error("Room not found.");
  if (room.hostId !== userId && !room.participants.some((participant) => participant.userId === userId)) {
    throw new Error("Forbidden");
  }
}

function buildAdminState(room: NonNullable<RoomBundle>): MemeMatchAdminRoomView {
  const state = buildState(room, room.hostId);
  return {
    code: state.room.code,
    phase: state.room.phase,
    currentRound: state.room.currentRound,
    participantCount: state.participants.length,
    id: state.room.id,
    host: state.room.host,
    totalRounds: state.room.totalRounds,
    createdAt: state.room.createdAt,
    startedAt: state.room.startedAt,
    completedAt: state.room.completedAt,
    participants: state.participants,
    rounds: state.rounds,
    submissions: room.rounds.flatMap((round) => round.submissions.map((submission) => ({
      id: submission.id,
      submissionId: submission.id,
      roundNumber: round.roundNumber,
      gifId: submission.gifId,
      gifUrl: submission.gifUrl,
      gifTitle: submission.gifTitle,
      previewUrl: submission.previewUrl,
      caption: submission.caption,
      anonymousLabel: displayLabel(submission.participant.displayOrder - 1),
      authorName: submission.participant.user.name,
      voteCount: submission.votes.length,
      createdAt: submission.submittedAt.toISOString(),
    }))),
    votes: room.rounds.flatMap((round) => round.votes.map((vote) => ({
      id: vote.id,
      roundNumber: round.roundNumber,
      voterName: room.participants.find((participant) => participant.id === vote.voterId)?.user.name ?? "Player",
      submissionId: vote.submissionId,
      participantId: vote.participantId,
      createdAt: vote.createdAt.toISOString(),
    }))),
    leaderboard: state.leaderboard,
  };
}

async function writeMemeMatchAudit(userId: string, action: string, entityId: string, payloadJson: Prisma.InputJsonValue) {
  await prisma.auditLog.create({
    data: { userId, action, entityType: "MemeMatchRoom", entityId, payloadJson },
  });
}

async function recalculateScores(tx: Prisma.TransactionClient, roomId: string) {
  const participants = await tx.memeMatchParticipant.findMany({ where: { roomId }, select: { id: true } });
  for (const participant of participants) {
    const score = await tx.memeMatchVote.count({ where: { participantId: participant.id } });
    await tx.memeMatchParticipant.update({ where: { id: participant.id }, data: { score } });
  }
}

async function assertPlayAccess() {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) {
    throw new Error("Forbidden");
  }
  return user;
}

async function choosePrompt(roomId: string, excludePromptIds: string[] = []) {
  const prompts = await prisma.memeMatchPrompt.findMany({
    where: { isActive: true, ...(excludePromptIds.length ? { id: { notIn: excludePromptIds } } : {}) },
    orderBy: [{ createdAt: "asc" }],
  });
  if (prompts.length > 0) return prompts[0];
  return prisma.memeMatchPrompt.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
}

async function getRoomAndParticipant(code: string, userId: string) {
  const room = await loadRoomBundle(code);
  ensureAccessibleRoom(room, userId);
  const participant = room?.participants.find((item) => item.userId === userId) ?? null;
  return { room, participant };
}

async function broadcastRoom(code: string, viewerUserId?: string) {
  const room = await loadRoomBundle(code);
  if (!room) return null;
  const viewerId = viewerUserId ?? room.hostId;
  return buildState(room, viewerId);
}

class MemeMatchSseService {
  private clients = new Map<string, Array<{ id: string; write: (data: string) => void }>>();

  subscribe(roomCode: string, clientId: string, write: (data: string) => void) {
    const list = this.clients.get(roomCode) ?? [];
    list.push({ id: clientId, write });
    this.clients.set(roomCode, list);
  }

  unsubscribe(roomCode: string, clientId: string) {
    const list = this.clients.get(roomCode);
    if (!list) return;
    const next = list.filter((client) => client.id !== clientId);
    if (next.length === 0) this.clients.delete(roomCode);
    else this.clients.set(roomCode, next);
  }

  async broadcast(roomCode: string, event: string, viewerUserId?: string) {
    const payload = await broadcastRoom(roomCode, viewerUserId);
    const list = this.clients.get(roomCode);
    if (!list?.length || !payload) return;
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of list) {
      try {
        client.write(message);
      } catch {
        // Ignore dead clients.
      }
    }
  }
}

export const memeMatchSseService = new MemeMatchSseService();

export const memeMatchService = {
  async getActiveRooms(): Promise<MemeMatchActiveRoomView[]> {
    const rooms = await prisma.memeMatchRoom.findMany({
      where: { phase: { not: MemeMatchPhase.complete } },
      select: { code: true, phase: true, currentRound: true, _count: { select: { participants: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rooms.map(room => ({ code: room.code, phase: room.phase, currentRound: room.currentRound, participantCount: room._count.participants }));
  },

  async getAdminRooms(): Promise<MemeMatchAdminRoomView[]> {
    const rooms = await prisma.memeMatchRoom.findMany({ select: { code: true }, orderBy: { updatedAt: "desc" } });
    const states = await Promise.all(rooms.map((room) => this.getAdminRoom(room.code)));
    return states.filter((state): state is MemeMatchAdminRoomView => Boolean(state));
  },

  async getCleanupHistory(): Promise<MemeMatchCleanupView[]> {
    const logs = await prisma.auditLog.findMany({
      where: { action: "meme_match.cleanup", entityType: "MemeMatchRoom" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return logs.map((log) => {
      const payload = log.payloadJson && typeof log.payloadJson === "object" && !Array.isArray(log.payloadJson) ? log.payloadJson as Record<string, unknown> : {};
      return {
        id: log.id,
        roomCode: typeof payload.roomCode === "string" ? payload.roomCode : "Unknown",
        completedAt: typeof payload.completedAt === "string" ? payload.completedAt : null,
        participantCount: typeof payload.participantCount === "number" ? payload.participantCount : 0,
        cleanedAt: log.createdAt.toISOString(),
      };
    });
  },

  async getAdminRoom(code: string): Promise<MemeMatchAdminRoomView | null> {
    const room = await loadRoomBundle(code);
    return room ? buildAdminState(room) : null;
  },

  async deleteRoom(userId: string, code: string) {
    const room = await loadRoomBundle(code);
    if (!room) throw new Error("Room not found.");
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { userId, action: "meme_match.room.deleted", entityType: "MemeMatchRoom", entityId: room.id, payloadJson: { roomCode: room.code, phase: room.phase, participantCount: room.participants.length } } });
      await tx.memeMatchRoom.delete({ where: { id: room.id } });
    });
    memeMatchSseService.broadcast(room.code, "room-deleted");
  },

  async moderateRoom(userId: string, code: string, input: {
    action: "force-advance" | "reopen" | "remove-submission" | "remove-vote";
    phase?: "submitting" | "voting" | "reveal";
    submissionId?: string;
    voteId?: string;
  }) {
    const room = await loadRoomBundle(code);
    if (!room) throw new Error("Room not found.");

    if (input.action === "remove-submission") {
      if (!input.submissionId) throw new Error("Submission is required.");
      if (!room.rounds.some((round) => round.submissions.some((submission) => submission.id === input.submissionId))) {
        throw new Error("Submission not found in this room.");
      }
      await prisma.$transaction(async (tx) => {
        await tx.memeMatchSubmission.delete({ where: { id: input.submissionId } });
        await recalculateScores(tx, room.id);
      });
    } else if (input.action === "remove-vote") {
      if (!input.voteId) throw new Error("Vote is required.");
      if (!room.rounds.some((round) => round.votes.some((vote) => vote.id === input.voteId))) {
        throw new Error("Vote not found in this room.");
      }
      await prisma.$transaction(async (tx) => {
        await tx.memeMatchVote.delete({ where: { id: input.voteId } });
        await recalculateScores(tx, room.id);
      });
    } else if (input.action === "reopen") {
      if (!input.phase) throw new Error("Phase is required.");
      const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRound);
      if (!currentRound) throw new Error("Current round not found.");
      await prisma.$transaction(async (tx) => {
        await tx.memeMatchRoom.update({
          where: { id: room.id },
          data: { phase: input.phase, completedAt: null },
        });
        await tx.memeMatchRound.update({
          where: { id: currentRound.id },
          data: {
            advancedToVoteAt: input.phase === "submitting" ? null : currentRound.advancedToVoteAt ?? new Date(),
            revealedAt: input.phase === "reveal" ? currentRound.revealedAt ?? new Date() : null,
            completedAt: null,
          },
        });
      });
    } else {
      const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRound);
      if (room.phase === MemeMatchPhase.lobby) {
        const prompt = await choosePrompt(room.id);
        if (!prompt) throw new Error("No active prompts available.");
        await prisma.$transaction(async (tx) => {
          await tx.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.submitting, currentRound: 1, startedAt: room.startedAt ?? new Date(), activePromptId: prompt.id } });
          await tx.memeMatchRound.create({ data: { roomId: room.id, roundNumber: 1, promptId: prompt.id } });
        });
      } else if (!currentRound) {
        throw new Error("Current round not found.");
      } else if (room.phase === MemeMatchPhase.submitting) {
        await prisma.$transaction(async (tx) => {
          await tx.memeMatchRound.update({ where: { id: currentRound.id }, data: { advancedToVoteAt: new Date() } });
          await tx.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.voting } });
        });
      } else if (room.phase === MemeMatchPhase.voting) {
        await prisma.$transaction(async (tx) => {
          await tx.memeMatchRound.update({ where: { id: currentRound.id }, data: { revealedAt: new Date() } });
          await tx.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.reveal } });
        });
      } else if (room.phase === MemeMatchPhase.reveal) {
        if (room.currentRound >= room.totalRounds) {
          await prisma.$transaction(async (tx) => {
            await tx.memeMatchRound.update({ where: { id: currentRound.id }, data: { completedAt: new Date() } });
            await tx.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.complete, completedAt: new Date() } });
          });
        } else {
          const nextPrompt = await choosePrompt(room.id, room.rounds.map((round) => round.promptId));
          if (!nextPrompt) throw new Error("No active prompts available.");
          const nextRoundNumber = room.currentRound + 1;
          await prisma.$transaction(async (tx) => {
            await tx.memeMatchRound.update({ where: { id: currentRound.id }, data: { completedAt: new Date() } });
            await tx.memeMatchRound.create({ data: { roomId: room.id, roundNumber: nextRoundNumber, promptId: nextPrompt.id } });
            await tx.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.submitting, currentRound: nextRoundNumber, activePromptId: nextPrompt.id } });
          });
        }
      } else {
        throw new Error("This room cannot advance.");
      }
    }

    await writeMemeMatchAudit(userId, `meme_match.admin.${input.action}`, room.id, {
      code,
      phase: input.phase ?? null,
      submissionId: input.submissionId ?? null,
      voteId: input.voteId ?? null,
    });
    await memeMatchSseService.broadcast(code, "room-state", room.hostId);
    return this.getAdminRoom(code);
  },

  async createRoom(userId: string) {
    const code = await (async () => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const generated = makeRoomCode();
        const exists = await prisma.memeMatchRoom.findUnique({ where: { code: generated }, select: { id: true } });
        if (!exists) return generated;
      }
      throw new Error("Unable to generate room code.");
    })();

    return prisma.$transaction(async (tx) => {
      const room = await tx.memeMatchRoom.create({
        data: {
          code,
          hostId: userId,
          phase: MemeMatchPhase.lobby,
          totalRounds: DEFAULT_TOTAL_ROUNDS,
          participants: { create: { userId, displayOrder: 1 } },
        },
        include: { host: { select: { id: true, name: true, email: true } } },
      });
      return room;
    });
  },

  async joinRoom(userId: string, code: string) {
    const room = await prisma.memeMatchRoom.findUnique({
      where: { code },
      include: { participants: true },
    });
    if (!room) throw new Error("Room not found.");
    const existing = room.participants.find((participant) => participant.userId === userId);
    if (existing) return room;
    if (room.phase !== MemeMatchPhase.lobby) throw new Error("This room has already started.");
    if (room.participants.length >= MAX_PLAYERS) throw new Error("This room is full.");

    const nextOrder = Math.max(0, ...room.participants.map((participant) => participant.displayOrder)) + 1;
    await prisma.memeMatchParticipant.create({
      data: { roomId: room.id, userId, displayOrder: nextOrder },
    });
    const joinedRoom = await prisma.memeMatchRoom.findUniqueOrThrow({ where: { code }, include: { host: { select: { id: true, name: true, email: true } } } });
    await memeMatchSseService.broadcast(code, "room-state", userId);
    return joinedRoom;
  },

  async getRoomState(userId: string, code: string) {
    const { room } = await getRoomAndParticipant(code, userId);
    if (!room) throw new Error("Room not found.");
    return buildState(room, userId);
  },

  async searchGifs(userId: string, query: string) {
    await assertPlayAccess();
    return giphyService.search(query);
  },

  async startRoom(userId: string, code: string) {
    const { room } = await getRoomAndParticipant(code, userId);
    if (!room) throw new Error("Room not found.");
    if (room.hostId !== userId) throw new Error("Forbidden");
    if (room.phase !== MemeMatchPhase.lobby) throw new Error("Room has already started.");
    if (room.participants.length < MIN_PLAYERS) throw new Error("At least four players are required.");

    const prompt = await choosePrompt(room.id);
    if (!prompt) throw new Error("No active prompts available.");

    await prisma.$transaction(async (tx) => {
      await tx.memeMatchRoom.update({
        where: { id: room.id },
        data: {
          phase: MemeMatchPhase.submitting,
          currentRound: 1,
          startedAt: new Date(),
          activePromptId: prompt.id,
        },
      });
      await tx.memeMatchRound.create({
        data: {
          roomId: room.id,
          roundNumber: 1,
          promptId: prompt.id,
        },
      });
    });

    await memeMatchSseService.broadcast(code, "room-state", userId);
    return this.getRoomState(userId, code);
  },

  async advanceRoom(userId: string, code: string) {
    const { room } = await getRoomAndParticipant(code, userId);
    if (!room) throw new Error("Room not found.");
    if (room.hostId !== userId) throw new Error("Forbidden");
    if (room.phase === MemeMatchPhase.lobby || room.phase === MemeMatchPhase.complete) {
      throw new Error("This room cannot advance.");
    }
    const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRound);
    if (!currentRound) throw new Error("Current round not found.");

    if (room.phase === MemeMatchPhase.submitting) {
      await prisma.memeMatchRound.update({ where: { id: currentRound.id }, data: { advancedToVoteAt: new Date() } });
      await prisma.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.voting } });
    } else if (room.phase === MemeMatchPhase.voting) {
      await prisma.memeMatchRound.update({ where: { id: currentRound.id }, data: { revealedAt: new Date() } });
      await prisma.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.reveal } });
    } else if (room.phase === MemeMatchPhase.reveal) {
      await prisma.memeMatchRound.update({ where: { id: currentRound.id }, data: { completedAt: new Date() } });
      if (room.currentRound >= room.totalRounds) {
        await prisma.memeMatchRoom.update({ where: { id: room.id }, data: { phase: MemeMatchPhase.complete, completedAt: new Date() } });
      } else {
        const existingPromptIds = room.rounds.map((round) => round.promptId);
        const nextPrompt = await choosePrompt(room.id, existingPromptIds);
        if (!nextPrompt) throw new Error("No active prompts available.");
        const nextRoundNumber = room.currentRound + 1;
        await prisma.$transaction(async (tx) => {
          await tx.memeMatchRound.create({
            data: {
              roomId: room.id,
              roundNumber: nextRoundNumber,
              promptId: nextPrompt.id,
            },
          });
          await tx.memeMatchRoom.update({
            where: { id: room.id },
            data: {
              phase: MemeMatchPhase.submitting,
              currentRound: nextRoundNumber,
              activePromptId: nextPrompt.id,
            },
          });
        });
      }
    }

    await memeMatchSseService.broadcast(code, "room-state", userId);
    return this.getRoomState(userId, code);
  },

  async submit(userId: string, code: string, input: { gifId: string; gifUrl: string; gifTitle?: string | null; previewUrl?: string | null; caption: string }) {
    const { room, participant } = await getRoomAndParticipant(code, userId);
    if (!room) throw new Error("Room not found.");
    if (!participant) throw new Error("You are not in this room.");
    if (room.phase !== MemeMatchPhase.submitting) throw new Error("Submissions are closed.");
    const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRound);
    if (!currentRound) throw new Error("Current round not found.");

    await prisma.memeMatchSubmission.upsert({
      where: { roundId_participantId: { roundId: currentRound.id, participantId: participant.id } },
      create: {
        roomId: room.id,
        roundId: currentRound.id,
        participantId: participant.id,
        userId,
        gifId: input.gifId,
        gifUrl: input.gifUrl,
        gifTitle: input.gifTitle ?? null,
        previewUrl: input.previewUrl ?? null,
        caption: input.caption,
      },
      update: {
        gifId: input.gifId,
        gifUrl: input.gifUrl,
        gifTitle: input.gifTitle ?? null,
        previewUrl: input.previewUrl ?? null,
        caption: input.caption,
      },
    });

    await memeMatchSseService.broadcast(code, "submission", userId);
    return this.getRoomState(userId, code);
  },

  async vote(userId: string, code: string, input: { submissionId: string }) {
    const { room, participant } = await getRoomAndParticipant(code, userId);
    if (!room) throw new Error("Room not found.");
    if (!participant) throw new Error("You are not in this room.");
    if (room.phase !== MemeMatchPhase.voting) throw new Error("Voting is closed.");
    const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRound);
    if (!currentRound) throw new Error("Current round not found.");
    const submission = currentRound.submissions.find((item) => item.id === input.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.participantId === participant.id) throw new Error("You cannot vote for your own submission.");

    await prisma.$transaction(async (tx) => {
      await tx.memeMatchVote.create({
        data: {
          roomId: room.id,
          roundId: currentRound.id,
          voterId: participant.id,
          participantId: submission.participantId,
          submissionId: submission.id,
        },
      });
      await tx.memeMatchParticipant.update({
        where: { id: submission.participantId },
        data: { score: { increment: 1 } },
      });
    });

    await memeMatchSseService.broadcast(code, "vote", userId);
    return this.getRoomState(userId, code);
  },
};

export const memeMatchState = {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_TOTAL_ROUNDS,
  mapPhase,
};
