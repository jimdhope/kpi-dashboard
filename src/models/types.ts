
// src/models/types.ts

import { Timestamp } from 'firebase/firestore';

// Define the structure of a single rule, now with a 'type'
export interface RuleFormData {
  id?: string;
  name: string;
  emoji?: string;
  points: number;
  type: 'numeric' | 'checkbox';
}

// Competition Rule Template - for saving reusable rule sets
export interface CompetitionRuleTemplate {
  id: string;
  name: string;
  description?: string;
  rules: RuleDefinition[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface RuleDefinition {
  name: string;
  type: 'numeric' | 'checkbox';
  target?: number;
  points: number;
  emoji?: string;
}

// Competition Draft - for saving wizard progress
export interface CompetitionDraft {
  id: string;
  createdBy: string;
  currentStep: number;
  name?: string;
  campaignId?: string;
  selectedPods?: string[];
  rules?: RuleFormData[];
  teams?: TeamDefinition[];
  dailyTargets?: Record<string, number>;
  startDate?: Timestamp;
  endDate?: Timestamp;
  lastSavedAt: Timestamp;
  createdAt: Timestamp;
}

export interface TeamDefinition {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}
