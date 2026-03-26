import { activityRepository } from "@/server/repositories/activity-repository";
import { authService } from "@/server/services/auth-service";

export const activityService = {
  async logAgentAction(input: {
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    // Simple template logic for rich messages
    const richMessage = `${finalUserName} ${input.title.toLowerCase()}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
      richMessage,
    });
  },

  async logRecorderAction(input: {
    agentId: string;
    agentName: string;
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const recorder = await authService.requireCurrentUser();
    const richMessage = `${input.agentName} ${input.title.toLowerCase()} - recorded by ${recorder.name}`;
    
    return activityRepository.create({
      userId: input.agentId,
      agentName: input.agentName,
      recorderId: recorder.id,
      recorderName: recorder.name,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
      richMessage,
    });
  }
};
