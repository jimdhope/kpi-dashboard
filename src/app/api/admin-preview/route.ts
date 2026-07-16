import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ADMIN_PREVIEW_COOKIE,
  ADMIN_PREVIEW_DURATION_SECONDS,
  createAdminPreviewToken,
  verifyAdminPreviewToken,
} from "@/server/auth/admin-preview-token";
import { authService } from "@/server/services/auth-service";
import { userRepository } from "@/server/repositories/user-repository";
import { activityRepository } from "@/server/repositories/activity-repository";

const startSchema = z.object({ userId: z.string().min(1).max(100) }).strict();

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to update preview mode";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const actor = await authService.requireActualAdmin();
    const input = startSchema.parse(await request.json());
    if (input.userId === actor.id) {
      return NextResponse.json({ error: "You are already viewing the app as yourself." }, { status: 400 });
    }
    const targetRecord = await userRepository.findById(input.userId);
    if (!targetRecord) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const target = userRepository.mapUser(targetRecord);
    const { token, payload } = createAdminPreviewToken(actor.id, target.id);

    (await cookies()).set(ADMIN_PREVIEW_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_PREVIEW_DURATION_SECONDS,
      priority: "high",
    });
    await activityRepository.create({
      userId: target.id,
      type: "admin_preview_started",
      title: "User preview started",
      description: `${actor.name} started a read-only preview as ${target.name}.`,
      recorderId: actor.id,
      recorderName: actor.name,
      metadata: { targetUserId: target.id, expiresAt: new Date(payload.expiresAt * 1000).toISOString() },
    });
    return NextResponse.json({ success: true, expiresAt: new Date(payload.expiresAt * 1000).toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  try {
    const actor = await authService.requireActualAdmin();
    const token = verifyAdminPreviewToken(cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value);
    if (token?.actorId === actor.id) {
      const targetRecord = await userRepository.findById(token.targetId);
      const target = targetRecord ? userRepository.mapUser(targetRecord) : null;
      await activityRepository.create({
        userId: target?.id ?? null,
        type: "admin_preview_ended",
        title: "User preview ended",
        description: `${actor.name} ended${target ? ` the read-only preview as ${target.name}` : " a read-only user preview"}.`,
        recorderId: actor.id,
        recorderName: actor.name,
        metadata: { targetUserId: token.targetId },
      });
    }
    cookieStore.delete(ADMIN_PREVIEW_COOKIE);
    return NextResponse.json({ success: true });
  } catch (error) {
    cookieStore.delete(ADMIN_PREVIEW_COOKIE);
    return errorResponse(error);
  }
}
