import { prisma } from "@/server/db/client";

const RETENTION_DAYS = 30;

export async function deleteExpiredMemeMatchRooms(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);

  const rooms = await prisma.memeMatchRoom.findMany({
    where: { phase: "complete", completedAt: { not: null, lt: cutoff } },
    select: { id: true, code: true, completedAt: true, _count: { select: { participants: true } } },
  });
  if (!rooms.length) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.createMany({
      data: rooms.map((room) => ({
        action: "meme_match.cleanup",
        entityType: "MemeMatchRoom",
        entityId: room.id,
        payloadJson: { roomCode: room.code, completedAt: room.completedAt?.toISOString() ?? null, participantCount: room._count.participants },
      })),
    });
    await tx.memeMatchRoom.deleteMany({ where: { id: { in: rooms.map((room) => room.id) } } });
  });

  return rooms.length;
}
