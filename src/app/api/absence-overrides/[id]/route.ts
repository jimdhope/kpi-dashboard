import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { requireManagedUser } from "@/server/services/organization-scope-service";
import { requireResourceAccess } from "@/server/services/authorization";
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}) { try { const user=await requireResourceAccess("nav.settings.users","MANAGE"); const {id}=await params; const existing=await prisma.absencePresenceOverride.findUnique({where:{id},select:{userId:true}}); if(!existing)return errorResponse(404,"Override not found."); await requireManagedUser(user,existing.userId); await prisma.absencePresenceOverride.delete({where:{id}}); return ok({success:true}); } catch(error) { return error instanceof Error&&error.message==="Forbidden"?errorResponse(403,"Forbidden"):errorResponse(404,"Override not found."); } }
