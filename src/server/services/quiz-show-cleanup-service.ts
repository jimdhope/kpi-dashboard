import { prisma } from "@/server/db/client";

export async function deleteExpiredQuizShowRooms(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const rooms = await prisma.quizShowRoom.findMany({ where: { phase: "complete", completedAt: { not: null, lt: cutoff } }, select: { id: true, code: true, completedAt: true, _count: { select: { participants: true } } } });
  if (!rooms.length) return 0;
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.createMany({ data: rooms.map((room) => ({ action: "quiz_show.cleanup", entityType: "QuizShowRoom", entityId: room.id, payloadJson: { roomCode: room.code, completedAt: room.completedAt?.toISOString() ?? null, participantCount: room._count.participants } })) });
    await tx.quizShowRoom.deleteMany({ where: { id: { in: rooms.map((room) => room.id) } } });
  });
  return rooms.length;
}
