import { TeamsAutomationFactTemplate, TeamsAutomationDeliveryFormat, TeamsChannelCategory } from "@/lib/contracts";
import { teamsMessageTemplateRepository } from "@/server/repositories/teams-message-template-repository";
import { requireAdminUser } from "@/server/services/authorization";

export const teamsMessageTemplateService = {
  async listTemplates() {
    await requireAdminUser();
    return teamsMessageTemplateRepository.list();
  },

  async listTemplatesByCategory(category?: TeamsChannelCategory) {
    await requireAdminUser();
    return teamsMessageTemplateRepository.listByCategory(category);
  },

  async createTemplate(input: {
    name: string;
    category?: TeamsChannelCategory | null;
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
    variationsJson?: Record<string, unknown> | null;
    isDefault?: boolean;
    isActive: boolean;
  }) {
    await requireAdminUser();
    
    // If this template is set as default, unset other defaults for this category
    if (input.isDefault && input.category) {
      await teamsMessageTemplateRepository.clearDefaultsForCategory(input.category);
    }
    
    return teamsMessageTemplateRepository.create(input);
  },

  async updateTemplate(
    id: string,
    input: {
      name: string;
      category?: TeamsChannelCategory | null;
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
      variationsJson?: Record<string, unknown> | null;
      isDefault?: boolean;
      isActive: boolean;
    },
  ) {
    await requireAdminUser();
    
    // If this template is set as default, unset other defaults for this category
    if (input.isDefault && input.category) {
      await teamsMessageTemplateRepository.clearDefaultsForCategory(input.category);
    }
    
    return teamsMessageTemplateRepository.update(id, input);
  },

  async deleteTemplate(id: string) {
    await requireAdminUser();
    return teamsMessageTemplateRepository.delete(id);
  },

  async setDefault(id: string) {
    await requireAdminUser();
    const template = await teamsMessageTemplateRepository.findById(id);
    if (!template) {
      throw new Error("Template not found");
    }
    if (template.category) {
      await teamsMessageTemplateRepository.clearDefaultsForCategory(template.category);
    }
    // Need to pass all fields to update function - use existing template data
    return teamsMessageTemplateRepository.update(id, {
      name: template.name,
      category: template.category,
      deliveryFormat: template.deliveryFormat,
      titleTemplate: template.titleTemplate,
      messageTemplate: template.messageTemplate,
      facts: template.facts,
      adaptiveCardJson: template.adaptiveCardJson,
      imageTitleTemplate: template.imageTitleTemplate,
      imageSubtitleTemplate: template.imageSubtitleTemplate,
      imageMetricTemplate: template.imageMetricTemplate,
      imageFooterTemplate: template.imageFooterTemplate,
      imageAccentColor: template.imageAccentColor,
      variationsJson: template.variationsJson,
      isDefault: true,
      isActive: template.isActive,
    });
  },
};
