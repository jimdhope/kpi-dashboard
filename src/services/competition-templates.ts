// src/services/competition-templates.ts

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CompetitionRuleTemplate, RuleDefinition } from '@/models/types';

/**
 * Get all competition rule templates
 */
export async function getCompetitionRuleTemplates(): Promise<CompetitionRuleTemplate[]> {
  const q = query(collection(db, 'competitionRuleTemplates'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionRuleTemplate));
}

/**
 * Get a single competition rule template by ID
 */
export async function getCompetitionRuleTemplate(id: string): Promise<CompetitionRuleTemplate | null> {
  const docRef = doc(db, 'competitionRuleTemplates', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as CompetitionRuleTemplate;
  }
  return null;
}

/**
 * Get competition rule templates created by a specific user
 */
export async function getUserCompetitionRuleTemplates(userId: string): Promise<CompetitionRuleTemplate[]> {
  const q = query(
    collection(db, 'competitionRuleTemplates'),
    where('createdBy', '==', userId),
    orderBy('name')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionRuleTemplate));
}

/**
 * Create a new competition rule template
 */
export async function createCompetitionRuleTemplate(
  name: string,
  rules: RuleDefinition[],
  userId: string,
  description?: string
): Promise<CompetitionRuleTemplate> {
  const templateData = {
    name,
    description: description || '',
    rules,
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'competitionRuleTemplates'), templateData);
  return { id: docRef.id, ...templateData } as CompetitionRuleTemplate;
}

/**
 * Update an existing competition rule template
 */
export async function updateCompetitionRuleTemplate(
  id: string,
  updates: Partial<Pick<CompetitionRuleTemplate, 'name' | 'description' | 'rules'>>
): Promise<void> {
  const docRef = doc(db, 'competitionRuleTemplates', id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a competition rule template
 */
export async function deleteCompetitionRuleTemplate(id: string): Promise<void> {
  const docRef = doc(db, 'competitionRuleTemplates', id);
  await deleteDoc(docRef);
}

/**
 * Subscribe to competition rule templates (real-time updates)
 */
export function subscribeToCompetitionRuleTemplates(
  callback: (templates: CompetitionRuleTemplate[]) => void
): () => void {
  const q = query(collection(db, 'competitionRuleTemplates'), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionRuleTemplate));
    callback(templates);
  });
}

/**
 * Subscribe to user's competition rule templates (real-time updates)
 */
export function subscribeToUserCompetitionRuleTemplates(
  userId: string,
  callback: (templates: CompetitionRuleTemplate[]) => void
): () => void {
  const q = query(
    collection(db, 'competitionRuleTemplates'),
    where('createdBy', '==', userId),
    orderBy('name')
  );
  return onSnapshot(q, (snapshot) => {
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionRuleTemplate));
    callback(templates);
  });
}
