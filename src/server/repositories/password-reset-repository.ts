import { prisma } from "@/server/db/client";
import crypto from "crypto";

const RESET_TOKEN_EXPIRY_HOURS = 1;

export const passwordResetRepository = {
  generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  },

  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  },

  async create(userId: string) {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  },

  async findValid(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async consume(id: string) {
    await prisma.passwordResetToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  async deleteExpired() {
    await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  },
};
