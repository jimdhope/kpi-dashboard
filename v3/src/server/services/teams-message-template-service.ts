import { TeamsAutomationFactTemplate, TeamsAutomationDeliveryFormat } from "@/lib/contracts";
import { teamsMessageTemplateRepository } from "@/server/repositories/teams-message-template-repository";
import { requireAdminUser } from "@/server/services/authorization";

export const teamsMessageTemplateService = {
  async listTemplates() {
    await requireAdminUser();
    return teamsMessageTemplateRepository.list();
  },

  async createTemplate(input: {
    name: string;
    deliveryFormat: TeamsAutomationDeliveryFormat;
    titleTemplate: string;
    messageTemplate: string;
    facts: TeamsAutomationFactTemplate[];
    adaptiveCardJson?: string | null;
    imageTitleTemplate?: string | null;
    imageSubtitleTemplate?: string | null;
    imageMetricTemplate?: string | null;
    imageFooterTemplate?: string | null;
    imageAccentColor?: string | null;
    isActive: boolean;
  }) {
    await requireAdminUser();
    return teamsMessageTemplateRepository.create(input);
  },

  async updateTemplate(
    id: string,
    input: {
      name: string;
      deliveryFormat: TeamsAutomationDeliveryFormat;
      titleTemplate: string;
      messageTemplate: string;
      facts: TeamsAutomationFactTemplate[];
      adaptiveCardJson?: string | null;
      imageTitleTemplate?: string | null;
      imageSubtitleTemplate?: string | null;
      imageMetricTemplate?: string | null;
      imageFooterTemplate?: string | null;
      imageAccentColor?: string | null;
      isActive: boolean;
    },
  ) {
    await requireAdminUser();
    return teamsMessageTemplateRepository.update(id, input);
  },
};
