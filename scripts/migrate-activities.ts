/**
 * Activity History Enhancement Migration Script
 * 
 * Phase 5: Migration & Testing
 * 
 * This script migrates existing activity documents in Firestore to include
 * richMessage and agentName fields for the enhanced activity history display.
 * 
 * The migration:
 * - Is idempotent (safe to run multiple times)
 * - Handles rate limiting with batch updates
 * - Logs progress and results
 * - Skips already-migrated documents
 * 
 * Usage:
 *   npm run migrate:activities
 * 
 * Requirements:
 *   - Firebase service account JSON at scripts/service-account.json
 *   - Environment variables for Firebase config
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Activity type const (converted from enum for ts-node compatibility)
const ActivityType = {
  // Tracker activities
  TRACKER_CREATED: 'tracker_created',
  TRACKER_ENTRY_LOGGED: 'tracker_entry_logged',
  TRACKER_MILESTONE: 'tracker_milestone',
  
  // Competition activities
  COMPETITION_JOINED: 'competition_joined',
  COMPETITION_COMPLETED: 'competition_completed',
  COMPETITION_STARTED: 'competition_started',
  COMPETITION_WON: 'competition_won',
  COMPETITION_SCORE_LOGGED: 'competition_score_logged',
  COMPETITION_MILESTONE: 'competition_milestone',
  COMPETITION_ABSENT: 'competition_absent',
  
  // Score activities
  SCORE_LOGGED: 'score_logged',
  ACHIEVEMENT_EARNED: 'achievement_earned',
  MILESTONE_REACHED: 'milestone_reached',
  
  // KPI activities
  KPI_CREATED: 'kpi_created',
  KPI_UPDATED: 'kpi_updated',
  KPI_GOAL_REACHED: 'kpi_goal_reached',
  KPI_GOAL_ACHIEVED: 'kpi_goal_achieved',
  KPI_TREND_IMPROVED: 'kpi_trend_improved',
  
  // Game activities
  GAME_PLAYED: 'game_played',
  GAME_WON: 'game_won',
  GAME_HIGH_SCORE: 'game_high_score',
  GAME_ACHIEVEMENT: 'game_achievement',
  
  // Profile activities
  PROFILE_UPDATED: 'profile_updated',
  BADGE_EARNED: 'badge_earned',
} as const;

type ActivityType = typeof ActivityType[keyof typeof ActivityType];

// Rich message templates (mirrored from src/lib/firestore/activities.ts)
const RICH_MESSAGE_TEMPLATES: Record<string, string> = {
  [ActivityType.TRACKER_CREATED]: '{{agentName}} created tracker "{{entityName}}"',
  [ActivityType.TRACKER_ENTRY_LOGGED]: '{{agentName}} logged {{value}} on "{{entityName}}"{{#if recorderName}} (by {{recorderName}}){{/if}}',
  [ActivityType.TRACKER_MILESTONE]: '{{agentName}} reached milestone "{{value}}" on "{{entityName}}"',
  
  [ActivityType.COMPETITION_JOINED]: '{{agentName}} joined competition "{{entityName}}"',
  [ActivityType.COMPETITION_COMPLETED]: '{{agentName}} completed competition "{{entityName}}"',
  [ActivityType.COMPETITION_STARTED]: '{{agentName}} started competition "{{entityName}}"',
  [ActivityType.COMPETITION_WON]: '{{agentName}} won competition "{{entityName}}"!',
  [ActivityType.COMPETITION_SCORE_LOGGED]: '{{agentName}} logged {{points}} points on "{{entityName}}"{{#if recorderName}} (by {{recorderName}}){{/if}}',
  [ActivityType.COMPETITION_MILESTONE]: '{{agentName}} reached milestone "{{value}}" on "{{entityName}}"',
  [ActivityType.COMPETITION_ABSENT]: '{{agentName}} was absent from "{{entityName}}"{{#if recorderName}} (logged by {{recorderName}}){{/if}}',
  
  [ActivityType.SCORE_LOGGED]: '{{agentName}} logged {{points}} points{{#if entityName}} for "{{entityName}}"{{/if}}{{#if recorderName}} (by {{recorderName}}){{/if}}',
  [ActivityType.ACHIEVEMENT_EARNED]: '{{agentName}} earned achievement "{{entityName}}" (+{{points}} pts)',
  [ActivityType.MILESTONE_REACHED]: '{{agentName}} reached milestone "{{entityName}}" (+{{points}} pts)',
  [ActivityType.BADGE_EARNED]: '{{agentName}} earned badge "{{entityName}}"',
  
  [ActivityType.KPI_CREATED]: '{{agentName}} created KPI "{{entityName}}"',
  [ActivityType.KPI_UPDATED]: '{{agentName}} updated KPI "{{entityName}}" to {{value}}',
  [ActivityType.KPI_GOAL_REACHED]: '{{agentName}} reached goal on "{{entityName}}"! (+{{points}} pts)',
  [ActivityType.KPI_GOAL_ACHIEVED]: '{{agentName}} achieved goal on "{{entityName}}"! (+{{points}} pts)',
  [ActivityType.KPI_TREND_IMPROVED]: '{{agentName}} improved trend on "{{entityName}}" - {{value}}',
  
  [ActivityType.GAME_PLAYED]: '{{agentName}} played "{{entityName}}"',
  [ActivityType.GAME_WON]: '{{agentName}} won "{{entityName}}" with {{value}} points!',
  [ActivityType.GAME_HIGH_SCORE]: '{{agentName}} achieved high score of {{value}} on "{{entityName}}"',
  [ActivityType.GAME_ACHIEVEMENT]: '{{agentName}} unlocked "{{value}}" on "{{entityName}}"',
  
  [ActivityType.PROFILE_UPDATED]: '{{agentName}} updated profile',
};

// Interface for activity document data
interface ActivityData {
  agentId: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  richMessage?: string;
  agentName?: string;
  recorderId?: string;
  recorderName?: string;
  timestamp?: admin.firestore.Timestamp;
}

// Interface for agent document data
interface AgentData {
  id: string;
  displayName?: string;
  firstName?: string;
  name?: string;
  lastName?: string;
  email?: string;
}

/**
 * Build a rich message from a template
 */
function buildRichMessage(
  type: ActivityType,
  params: {
    agentName: string;
    entityName: string;
    value?: string | number;
    points?: number;
    recorderName?: string;
  }
): string {
  const template = RICH_MESSAGE_TEMPLATES[type];
  
  if (!template) {
    return `${params.agentName} performed action on ${params.entityName}`;
  }
  
  let message = template
    .replace(/\{\{agentName\}\}/g, params.agentName)
    .replace(/\{\{entityName\}\}/g, params.entityName)
    .replace(/\{\{value\}\}/g, String(params.value ?? ''))
    .replace(/\{\{points\}\}/g, String(params.points ?? 0))
    .replace(/\{\{recorderName\}\}/g, params.recorderName ?? '');
  
  // Handle conditional blocks {{#if field}}...{{/if}}
  message = message.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, field, content) => {
    const fieldValue = params[field as keyof typeof params];
    return fieldValue ? content : '';
  });
  
  return message;
}

/**
 * Extract entity name from activity metadata
 */
function extractEntityName(activity: ActivityData): string {
  const metadata = activity.metadata || {};
  
  // Try different metadata fields for entity name
  return (
    (metadata.trackerName as string) ||
    (metadata.competitionName as string) ||
    (metadata.kpiName as string) ||
    (metadata.gameName as string) ||
    (metadata.ruleName as string) ||
    (metadata.achievementName as string) ||
    (metadata.badgeName as string) ||
    (metadata.milestoneName as string) ||
    (metadata.milestone as string) ||
    activity.title ||
    'Activity'
  );
}

/**
 * Extract value from activity metadata
 */
function extractValue(activity: ActivityData): string | number | undefined {
  const metadata = activity.metadata || {};
  
  if (metadata.value !== undefined) {
    return metadata.value as string | number;
  }
  if (metadata.score !== undefined) {
    return metadata.score as number;
  }
  if (metadata.newValue !== undefined) {
    return metadata.newValue as number;
  }
  
  return undefined;
}

/**
 * Main migration function
 */
async function migrateActivities(): Promise<void> {
  console.log('========================================');
  console.log('   Activity History Migration Script    ');
  console.log('========================================\n');
  console.log('This script will:');
  console.log('  1. Query all agents in Firestore');
  console.log('  2. For each agent, query their activities');
  console.log('  3. Update activities missing richMessage field');
  console.log('  4. Add agentName for proper attribution\n');
  console.log('The migration is idempotent - safe to run multiple times.\n');
  
  // Initialize Firebase Admin SDK (ESM compatible)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const serviceAccountPath = path.join(__dirname, 'service-account.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: service-account.json not found in scripts/ directory');
    console.log('Please download your Firebase service account JSON and save it as:');
    console.log('  scripts/service-account.json\n');
    console.log('Get it from: Firebase Console > Project Settings > Service Accounts > Generate new private key');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();
  
  console.log('Firebase Admin SDK initialized.\n');
  
  // Fetch all users (from 'users' collection, not 'agents')
  console.log('Fetching all users from Firestore...\n');
  
  const usersSnapshot = await db.collection('users').get();
  
  if (usersSnapshot.empty) {
    console.log('No users found in the database.');
    console.log('Migration complete (nothing to do).\n');
    return;
  }
  
  console.log(`Found ${usersSnapshot.size} user(s) to process.\n`);
  
  // Build a map of user names for quick lookup
  const userNames: Map<string, string> = new Map();
  
  usersSnapshot.forEach((doc) => {
    const userData = doc.data() as AgentData;
    // User collection uses 'name' field (not 'displayName')
    const name = userData.name || userData.displayName || userData.firstName || userData.email || 'Unknown User';
    userNames.set(doc.id, name);
  });
  
  // Track migration statistics
  let totalActivitiesFound = 0;
  let totalActivitiesMigrated = 0;
  let totalActivitiesSkipped = 0;
  let totalActivitiesError = 0;
  const errors: Array<{ agentId: string; activityId: string; error: string }> = [];
  
  // Query the flat 'activities' collection
  console.log('Querying flat activities collection...\n');
  
  // First, let's see how many activities exist
  const allActivitiesSnapshot = await db.collection('activities').limit(1).get();
  const activitiesCollectionRef = db.collection('activities');
  
  // Count total activities
  let totalActivityCount = 0;
  const countSnapshot = await activitiesCollectionRef.get();
  totalActivityCount = countSnapshot.size;
  
  if (totalActivityCount === 0) {
    console.log('No activities found in the flat activities collection.');
    console.log('Migration complete (nothing to do).\n');
    return;
  }
  
  console.log(`Found ${totalActivityCount} total activities to process.\n`);
  
  // Process each user's activities from the flat collection
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userName = userNames.get(userId) || 'Unknown User';
    
    console.log(`Processing user: ${userName} (${userId})`);
    
    // Query activities for this specific user from flat collection
    const activitiesSnapshot = await activitiesCollectionRef
      .where('agentId', '==', userId)
      .get();
    
    if (activitiesSnapshot.empty) {
      console.log(`  No activities found for this user.\n`);
      continue;
    }
    
    console.log(`  Found ${activitiesSnapshot.size} activities.`);
    
    let agentMigrated = 0;
    let agentSkipped = 0;
    let agentError = 0;
    
    // Process in batches of 100 (Firestore limit)
    const BATCH_SIZE = 100;
    let batch = db.batch();
    let batchCount = 0;
    
    // Safety check for docs
    const docs = activitiesSnapshot.docs;
    if (!docs || docs.length === 0) {
      console.log(`  No activities found (after empty check).\n`);
      continue;
    }
    
    for (const activityDoc of docs) {
      const activity = activityDoc.data() as ActivityData;
      totalActivitiesFound++;
      
      // Safety check for activity data
      if (!activity || !activity.type) {
        console.log(`    [WARN] Activity ${activityDoc.id} has invalid data, skipping`);
        agentSkipped++;
        totalActivitiesSkipped++;
        continue;
      }
      
      // Skip if already migrated (idempotent check)
      if (activity.richMessage) {
        agentSkipped++;
        totalActivitiesSkipped++;
        continue;
      }
      
      // Skip if type is invalid - use hardcoded list for safety
      const validTypesList = [
        'tracker_created', 'tracker_entry_logged', 'tracker_milestone',
        'competition_joined', 'competition_completed', 'competition_started',
        'competition_won', 'competition_score_logged', 'competition_milestone', 'competition_absent',
        'score_logged', 'achievement_earned', 'milestone_reached', 'badge_earned',
        'kpi_created', 'kpi_updated', 'kpi_goal_reached', 'kpi_goal_achieved', 'kpi_trend_improved',
        'game_played', 'game_won', 'game_high_score', 'game_achievement',
        'profile_updated'
      ];
      if (!validTypesList.includes(activity.type as string)) {
        console.log(`    [WARN] Activity ${activityDoc.id} has unknown type: ${activity.type}`);
        agentSkipped++;
        totalActivitiesSkipped++;
        continue;
      }
      
      try {
        // Build the rich message
        const entityName = extractEntityName(activity);
        const value = extractValue(activity);
        const points = (activity.metadata?.points as number) || 0;
        const recorderName = activity.recorderName;
        
        const richMessage = buildRichMessage(activity.type, {
          agentName: userName,
          entityName,
          value,
          points,
          recorderName,
        });
        
        // Add to batch (flat collection - use activitiesCollectionRef)
        const activityRef = activitiesCollectionRef.doc(activityDoc.id);
        batch.update(activityRef, {
          richMessage,
          agentName: userName,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        batchCount++;
        agentMigrated++;
        totalActivitiesMigrated++;
        
        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`    Committed batch of ${batchCount} updates.`);
          batch = db.batch();
          batchCount = 0;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`    [ERROR] Activity ${activityDoc.id}: ${errorMessage}`);
        errors.push({ agentId: userId, activityId: activityDoc.id, error: errorMessage });
        agentError++;
        totalActivitiesError++;
      }
    }
    
    // Commit any remaining updates in the batch
    if (batchCount > 0) {
      try {
        await batch.commit();
        console.log(`    Committed final batch of ${batchCount} updates.`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`    [ERROR] Final batch commit failed: ${errorMessage}`);
        errors.push({ agentId: userId, activityId: 'batch-commit', error: errorMessage });
      }
    }
    
    console.log(`  Summary: ${agentMigrated} migrated, ${agentSkipped} skipped, ${agentError} errors.\n`);
    
    // Add a small delay between users to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  // Print final summary
  console.log('========================================');
  console.log('           MIGRATION COMPLETE           ');
  console.log('========================================');
  console.log(`  Total activities found:  ${totalActivitiesFound}`);
  console.log(`  Total migrated:          ${totalActivitiesMigrated}`);
  console.log(`  Total skipped:           ${totalActivitiesSkipped}`);
  console.log(`  Total errors:            ${totalActivitiesError}`);
  console.log('========================================\n');
  
  if (errors.length > 0) {
    console.log('Errors encountered:');
    errors.slice(0, 10).forEach((err) => {
      console.log(`  - Agent ${err.agentId}, Activity ${err.activityId}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors.\n`);
    }
    console.log('');
  }
  
  if (totalActivitiesMigrated > 0) {
    console.log('SUCCESS: Activities have been updated with richMessage and agentName fields.');
    console.log('The activity history enhancement is now active for migrated documents.\n');
  } else if (totalActivitiesSkipped > 0 && totalActivitiesMigrated === 0) {
    console.log('INFO: All activities were already migrated (or no valid activities found).');
    console.log('No updates were necessary.\n');
  } else {
    console.log('WARNING: No activities were migrated. Check the errors above.\n');
  }
}

// Run the migration
migrateActivities()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
