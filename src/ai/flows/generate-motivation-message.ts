'use server';
/**
 * @fileOverview A motivation message generation AI agent.
 *
 * - generateMotivationMessage - A function that handles the motivation message generation process.
 * - GenerateMotivationMessageInput - The input type for the generateMotivationMessage function.
 * - GenerateMotivationMessageOutput - The return type for the generateMotivationMessage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {getKPIs, Group, KPI} from '@/services/kpi';

const GenerateMotivationMessageInputSchema = z.object({
  groupId: z.string().describe('The ID of the group (campaign, pod, or team).'),
  userId: z.string().describe('The ID of the user.'),
});
export type GenerateMotivationMessageInput = z.infer<typeof GenerateMotivationMessageInputSchema>;

const GenerateMotivationMessageOutputSchema = z.object({
  message: z.string().describe('The personalized motivation message.'),
});
export type GenerateMotivationMessageOutput = z.infer<typeof GenerateMotivationMessageOutputSchema>;

export async function generateMotivationMessage(
  input: GenerateMotivationMessageInput
): Promise<GenerateMotivationMessageOutput> {
  return generateMotivationMessageFlow(input);
}

const getKpisTool = ai.defineTool({
  name: 'getKpis',
  description: 'Retrieves the KPIs for a given group.',
  inputSchema: z.object({
    groupId: z.string().describe('The ID of the group to retrieve KPIs for.'),
  }),
  outputSchema: z.array(z.object({
    name: z.string(),
    target: z.number(),
    achievement: z.number(),
  })),
}, async (input) => {
  const group: Group = {id: input.groupId, name: 'My Group'}; // Consider fetching group name if needed
  return await getKPIs(group);
});

const motivationPrompt = ai.definePrompt({
  name: 'motivationPrompt',
  input: {
    schema: z.object({
      userId: z.string().describe('The ID of the user.'),
      groupId: z.string().describe('The ID of the group (campaign, pod, or team).'),
    }),
  },
  output: {
    schema: z.object({
      message: z.string().describe('The personalized motivation message.'),
    }),
  },
  tools: [getKpisTool],
  system: `You are a motivational AI assistant for KpiQuest. Your goal is to provide concise, positive, and personalized encouragement to users based on their progress towards their KPIs within their group (pod or team).

  You have access to a tool, 'getKpis', which retrieves the Key Performance Indicators (KPIs) for a given group ID. Use this tool to understand the user's group's current progress before crafting the message.

  Analyze the retrieved KPIs and create a short, uplifting message (1-2 sentences) for the specific user (userId) within the context of their group (groupId).

  Consider these factors:
  - Focus on progress and encouragement, not just raw numbers.
  - Highlight areas where the group is close to achieving targets or has made good progress.
  - Acknowledge positive trends or significant achievements if evident.
  - Frame suggestions positively (e.g., "Let's keep the momentum going!") rather than negatively.
  - Keep the tone friendly and motivating.
  - The message should feel relevant to the user, even if based on group KPIs.

  Example based on fetched KPIs:
  KPIs: [{ name: 'Sales', target: 1000000, achievement: 750000 }, { name: 'Customer Acquisition', target: 1000, achievement: 800 }]
  Message: "Great push on Customer Acquisition, almost there! Let's keep that energy going to hit our Sales target together!"
  `,
  prompt: `Generate a concise and personalized motivation message for user {{userId}} in group {{groupId}}. Use the getKpis tool to fetch the group's KPI data first. Keep it positive and focused on encouragement.`,
});

const generateMotivationMessageFlow = ai.defineFlow<
  typeof GenerateMotivationMessageInputSchema,
  typeof GenerateMotivationMessageOutputSchema
>({
  name: 'generateMotivationMessageFlow',
  inputSchema: GenerateMotivationMessageInputSchema,
  outputSchema: GenerateMotivationMessageOutputSchema,
}, async input => {
  try {
      const { output } = await motivationPrompt(input);
      if (!output) {
          console.error("Motivation prompt returned no output for input:", input);
          // Provide a default fallback message
          return { message: "Keep up the great work! Every step forward counts." };
      }
      return output;
  } catch (error) {
      console.error("Error in generateMotivationMessageFlow for input:", input, "Error:", error);
      // Provide a default fallback message in case of error
       return { message: "Let's keep pushing towards our goals! You've got this." };
  }
});
