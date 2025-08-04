
// src/models/types.ts

// Define the structure of a single rule, now with a 'type'
export interface RuleFormData {
  id?: string;
  name: string;
  emoji?: string;
  points: number;
  type: 'numeric' | 'checkbox';
}
