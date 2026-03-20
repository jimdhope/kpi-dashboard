// src/services/competition-drafts.ts

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
import type { CompetitionDraft, RuleFormData, TeamDefinition } from '@/models/types';

/**
 * Get all competition drafts for a specific user
 */
export async function getUserCompetitionDrafts(userId: string): Promise<CompetitionDraft[]> {
  const q = query(
    collection(db, 'competitionDrafts'),
    where('createdBy', '==', userId),
    orderBy('lastSavedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionDraft));
}

/**
 * Get a single competition draft by ID
 */
export async function getCompetitionDraft(id: string): Promise<CompetitionDraft | null> {
  const docRef = doc(db, 'competitionDrafts', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as CompetitionDraft;
  }
  return null;
}

/**
 * Save or update a competition draft
 */
export async function saveCompetitionDraft(
  userId: string,
  draftData: Partial<Omit<CompetitionDraft, 'id' | 'createdBy' | 'lastSavedAt' | 'createdAt'>>,
  existingDraftId?: string
): Promise<CompetitionDraft> {
  const now = Timestamp.now();
  
  if (existingDraftId) {
    // Update existing draft
    const docRef = doc(db, 'competitionDrafts', existingDraftId);
    const updates = {
      ...draftData,
      lastSavedAt: now,
    };
    await updateDoc(docRef, updates);
    
    const updatedSnap = await getDoc(docRef);
    return { id: updatedSnap.id, ...updatedSnap.data() } as CompetitionDraft;
  } else {
    // Create new draft
    const newDraft = {
      createdBy: userId,
      currentStep: draftData.currentStep ?? 0,
      name: draftData.name ?? '',
      campaignId: draftData.campaignId ?? '',
      selectedPods: draftData.selectedPods ?? [],
      rules: draftData.rules ?? [],
      teams: draftData.teams ?? [],
      dailyTargets: draftData.dailyTargets ?? {},
      startDate: draftData.startDate,
      endDate: draftData.endDate,
      lastSavedAt: now,
      createdAt: now,
    };
    
    const docRef = await addDoc(collection(db, 'competitionDrafts'), newDraft);
    return { id: docRef.id, ...newDraft } as CompetitionDraft;
  }
}

/**
 * Delete a competition draft
 */
export async function deleteCompetitionDraft(id: string): Promise<void> {
  const docRef = doc(db, 'competitionDrafts', id);
  await deleteDoc(docRef);
}

/**
 * Subscribe to user's competition drafts (real-time updates)
 */
export function subscribeToUserCompetitionDrafts(
  userId: string,
  callback: (drafts: CompetitionDraft[]) => void
): () => void {
  const q = query(
    collection(db, 'competitionDrafts'),
    where('createdBy', '==', userId),
    orderBy('lastSavedAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const drafts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionDraft));
    callback(drafts);
  });
}

/**
 * Delete all drafts for a user (cleanup)
 */
export async function deleteAllUserDrafts(userId: string): Promise<void> {
  const drafts = await getUserCompetitionDrafts(userId);
  const deletePromises = drafts.map(draft => deleteCompetitionDraft(draft.id));
  await Promise.all(deletePromises);
}
