import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { getManagedPodIds, requireManagedUser } from "@/server/services/organization-scope-service";
import { requireResourceAccess } from "@/server/services/authorization";

const schema = z.object({ userId: z.string().min(1), date: z.string().datetime() });
async function requireManager() { return requireResourceAccess("nav.settings.users", "MANAGE"); }

export async function GET(request: Request) { try { const manager=await requireManager(); const date = new URL(request.url).searchParams.get("date"); if (!date) return errorResponse(400, "Date is required."); const day = new Date(date); day.setUTCHours(0,0,0,0); const next = new Date(day); next.setUTCDate(next.getUTCDate()+1); const managedPodIds=await getManagedPodIds(manager,"people"); const userIds=managedPodIds===null?null:(await prisma.podMembership.findMany({where:{podId:{in:managedPodIds}},select:{userId:true},distinct:["userId"]})).map((item)=>item.userId); return ok({ overrides: await prisma.absencePresenceOverride.findMany({ where: { date: { gte: day, lt: next }, ...(userIds?{userId:{in:userIds}}:{}) } }) }); } catch { return errorResponse(403,"Forbidden"); } }
export async function POST(request: Request) { try { const manager=await requireManager(); const input=schema.parse(await request.json()); await requireManagedUser(manager,input.userId); const date=new Date(input.date); date.setUTCHours(0,0,0,0); const override=await prisma.absencePresenceOverride.upsert({where:{userId_date:{userId:input.userId,date}},create:{userId:input.userId,date,createdById:manager.id},update:{createdById:manager.id}}); return ok({override}); } catch(error) { return error instanceof z.ZodError?errorResponse(400,"Invalid override."):errorResponse(403,"Forbidden"); } }
