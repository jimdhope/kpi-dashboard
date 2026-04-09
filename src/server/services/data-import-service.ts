import { prisma } from "@/server/db/client";
import * as fs from 'fs';
import * as path from 'path';

export interface ImportResult {
  collection: string;
  imported: number;
  updated: number;
  errors: number;
  skipped?: number;
}

export interface ImportStatus {
  collection: string;
  inFile: number;
  inDb: number;
  status: 'complete' | 'partial' | 'missing';
}

const DEFAULT_EXPORT_PATH = path.join(process.cwd(), 'kpi_quest_export.json');

type UserIdMap = Map<string, string>;

export const dataImportService = {

  async getImportStatus(): Promise<ImportStatus[]> {
    let exportData: any = null;
    
    try {
      if (fs.existsSync(DEFAULT_EXPORT_PATH)) {
        const content = fs.readFileSync(DEFAULT_EXPORT_PATH, 'utf-8');
        exportData = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading export file:', error);
    }

    const statuses: ImportStatus[] = [];

    // Users
    const userCount = await prisma.user.count();
    statuses.push({
      collection: 'users',
      inFile: exportData?.users?.length || 0,
      inDb: userCount,
      status: exportData?.users?.length === userCount ? 'complete' : 'partial'
    });

    // Pods
    const podCount = await prisma.pod.count();
    statuses.push({
      collection: 'pods',
      inFile: exportData?.pods?.length || 0,
      inDb: podCount,
      status: exportData?.pods?.length === podCount ? 'complete' : 'partial'
    });

    // Competitions
    const compCount = await prisma.competition.count();
    statuses.push({
      collection: 'competitions',
      inFile: exportData?.competitions?.length || 0,
      inDb: compCount,
      status: exportData?.competitions?.length === compCount ? 'complete' : 'partial'
    });

    // Competition Teams
    const teamCount = await prisma.competitionTeam.count();
    const fileTeams = exportData?.competitions?.reduce((sum: number, comp: any) => sum + (comp.teams?.length || 0), 0) || 0;
    statuses.push({
      collection: 'competitionTeams',
      inFile: fileTeams,
      inDb: teamCount,
      status: fileTeams === teamCount ? 'complete' : 'partial'
    });

    // Competition Rules
    const ruleCount = await prisma.competitionRule.count();
    const fileRules = exportData?.competitions?.reduce((sum: number, comp: any) => sum + (comp.rules?.length || 0), 0) || 0;
    statuses.push({
      collection: 'competitionRules',
      inFile: fileRules,
      inDb: ruleCount,
      status: fileRules === ruleCount ? 'complete' : 'partial'
    });

    // Tracker KPIs
    const trackerCount = await prisma.trackerKpi.count();
    statuses.push({
      collection: 'trackerKpis',
      inFile: exportData?.trackerKpis?.length || 0,
      inDb: trackerCount,
      status: exportData?.trackerKpis?.length === trackerCount ? 'complete' : 'partial'
    });

    // Tracker Logs
    const trackerLogCount = await prisma.trackerLog.count();
    statuses.push({
      collection: 'trackerLogs',
      inFile: exportData?.trackerLogs?.length || 0,
      inDb: trackerLogCount,
      status: exportData?.trackerLogs?.length === trackerLogCount ? 'complete' : 'partial'
    });

    // KPIs (additionalKpis)
    const kpiCount = await prisma.kpi.count();
    statuses.push({
      collection: 'kpis',
      inFile: exportData?.additionalKpis?.length || 0,
      inDb: kpiCount,
      status: exportData?.additionalKpis?.length === kpiCount ? 'complete' : 'partial'
    });

    // KPI Logs (additionalKpiLogs)
    const kpiLogCount = await prisma.kpiLog.count();
    statuses.push({
      collection: 'kpiLogs',
      inFile: exportData?.additionalKpiLogs?.length || 0,
      inDb: kpiLogCount,
      status: exportData?.additionalKpiLogs?.length === kpiLogCount ? 'complete' : 'partial'
    });

    // Daily Achievements
    const achievementCount = await prisma.dailyAchievement.count();
    statuses.push({
      collection: 'achievements',
      inFile: exportData?.dailyAchievements?.length || 0,
      inDb: achievementCount,
      status: exportData?.dailyAchievements?.length === achievementCount ? 'complete' : 'partial'
    });

    // Pod Memberships
    const membershipCount = await prisma.podMembership.count();
    statuses.push({
      collection: 'podMemberships',
      inFile: exportData?.users?.length || 0,
      inDb: membershipCount,
      status: exportData?.users?.length === membershipCount ? 'complete' : 'partial'
    });

    // Campaigns
    const campaignCount = await prisma.campaign.count();
    statuses.push({
      collection: 'campaigns',
      inFile: exportData?.campaigns?.length || 0,
      inDb: campaignCount,
      status: exportData?.campaigns?.length === campaignCount ? 'complete' : 'partial'
    });

    return statuses;
  },

  /**
   * Build a map of Firebase UID to Database ID for all users
   */
  async buildUserIdMap(): Promise<UserIdMap> {
    const users = await prisma.user.findMany({
      select: { id: true, firebaseUid: true }
    });
    const map = new Map<string, string>();
    for (const user of users) {
      if (user.firebaseUid) {
        map.set(user.firebaseUid, user.id);
      }
    }
    return map;
  },

  async syncAll(source: 'existing' | 'upload' = 'existing'): Promise<{ results: ImportResult[]; duration: number }> {
    const startTime = Date.now();
    const results: ImportResult[] = [];

    let exportData: any = null;

    try {
      if (source === 'existing' && fs.existsSync(DEFAULT_EXPORT_PATH)) {
        const content = fs.readFileSync(DEFAULT_EXPORT_PATH, 'utf-8');
        exportData = JSON.parse(content);
      }
    } catch (error) {
      throw new Error(`Failed to read export file: ${error}`);
    }

    if (!exportData) {
      throw new Error('No export data available');
    }

    // 1. Import users first - but we can't create them (need passwords)
    // Instead, just build ID map from existing users in export
    const userIdMap = this.buildUserIdMapFromExport(exportData.users);
    results.push({ collection: 'users', imported: 0, updated: 0, errors: 0 });

    // 2. Import pods
    const podResult = await this.syncPods(exportData.pods);
    results.push(podResult);

    // 3. Import campaigns
    const campaignResult = await this.syncCampaigns(exportData.campaigns);
    results.push(campaignResult);

    // 4. Import competitions
    const compResult = await this.syncCompetitions(exportData.competitions);
    results.push(compResult);

    // 5. Import competition teams (with ID mapping)
    const teamResult = await this.syncCompetitionTeams(exportData.competitions, userIdMap);
    results.push(teamResult);

    // 6. Import competition rules (from nested data)
    const ruleResult = await this.syncCompetitionRules(exportData.competitions);
    results.push(ruleResult);

    // 7. Import tracker KPIs
    const trackerKpiResult = await this.syncTrackerKpis(exportData.trackerKpis);
    results.push(trackerKpiResult);

    // 8. Import tracker logs (with ID mapping)
    const trackerLogResult = await this.syncTrackerLogs(exportData.trackerLogs, userIdMap);
    results.push(trackerLogResult);

    // 9. Import daily achievements (with ID mapping)
    const achievementResult = await this.syncAchievements(exportData.dailyAchievements, userIdMap);
    results.push(achievementResult);

    // 10. Import pod memberships (derived from users)
    const membershipResult = await this.syncPodMemberships(exportData.users, userIdMap);
    results.push(membershipResult);

    const duration = Date.now() - startTime;

    // Log to database
    await prisma.importLog.create({
      data: {
        source,
        collections: results as unknown as object,
        durationMs: duration,
        status: results.every(r => r.errors === 0) ? 'success' : 'partial',
      }
    });

    return { results, duration };
  },

  /**
   * Build user ID map from export data (Firebase UID -> export ID)
   * This is used when we don't have users in DB yet
   */
  buildUserIdMapFromExport(users: any[]): UserIdMap {
    const map = new Map<string, string>();
    if (users) {
      for (const user of users) {
        if (user.uid) {
          map.set(user.uid, user.id);
        }
      }
    }
    return map;
  },

  async syncPods(pods: any[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!pods || pods.length === 0) {
      return { collection: 'pods', imported, updated, errors };
    }

    for (const pod of pods) {
      try {
        const existing = await prisma.pod.findUnique({
          where: { id: pod.id }
        });

        if (existing) {
          await prisma.pod.update({
            where: { id: pod.id },
            data: {
              name: pod.name,
              description: pod.description || '',
              podManagerId: pod.podManagerId || null,
              teamLeaderId: pod.teamLeaderId || null,
            }
          });
          updated++;
        } else {
          await prisma.pod.create({
            data: {
              id: pod.id,
              name: pod.name,
              description: pod.description || '',
              podManagerId: pod.podManagerId || null,
              teamLeaderId: pod.teamLeaderId || null,
            }
          });
          imported++;
        }
      } catch (error) {
        console.error(`Error syncing pod ${pod.id}:`, error);
        errors++;
      }
    }

    return { collection: 'pods', imported, updated, errors };
  },

  async syncCampaigns(campaigns: any[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!campaigns || campaigns.length === 0) {
      return { collection: 'campaigns', imported, updated, errors };
    }

    for (const campaign of campaigns) {
      try {
        const existing = await prisma.campaign.findUnique({
          where: { id: campaign.id }
        });

        if (existing) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              name: campaign.name,
              description: campaign.description || '',
              isActive: campaign.isActive ?? true,
            }
          });
          updated++;
        } else {
          await prisma.campaign.create({
            data: {
              id: campaign.id,
              name: campaign.name,
              description: campaign.description || '',
              isActive: campaign.isActive ?? true,
            }
          });
          imported++;
        }
      } catch (error) {
        console.error(`Error syncing campaign ${campaign.id}:`, error);
        errors++;
      }
    }

    return { collection: 'campaigns', imported, updated, errors };
  },

  async syncCompetitions(competitions: any[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!competitions || competitions.length === 0) {
      return { collection: 'competitions', imported, updated, errors };
    }

    for (const comp of competitions) {
      try {
        const existing = await prisma.competition.findUnique({
          where: { id: comp.id }
        });

        if (existing) {
          await prisma.competition.update({
            where: { id: comp.id },
            data: {
              name: comp.name,
              description: comp.description || '',
              startsAt: comp.startDate ? new Date(comp.startDate) : null,
              endsAt: comp.endDate ? new Date(comp.endDate) : null,
              isDraft: comp.status !== 'active',
              campaignId: comp.campaignId || null,
              podIds: comp.podIds || [],
              createdById: comp.createdById || null,
            }
          });
          updated++;
        } else {
          await prisma.competition.create({
            data: {
              id: comp.id,
              name: comp.name,
              description: comp.description || '',
              startsAt: comp.startDate ? new Date(comp.startDate) : null,
              endsAt: comp.endDate ? new Date(comp.endDate) : null,
              isDraft: comp.status !== 'active',
              campaignId: comp.campaignId || null,
              podIds: comp.podIds || [],
              createdById: comp.createdById || null,
            }
          });
          imported++;
        }
      } catch (error) {
        console.error(`Error syncing competition ${comp.id}:`, error);
        errors++;
      }
    }

    return { collection: 'competitions', imported, updated, errors };
  },

  async syncCompetitionTeams(competitions: any[], userIdMap: UserIdMap): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!competitions || competitions.length === 0) {
      return { collection: 'competitionTeams', imported, updated, errors };
    }

    for (const comp of competitions) {
      const teams = comp.teams || [];
      
      for (const team of teams) {
        try {
          // Map agentIds from Firebase UIDs to Database IDs
          const mappedAgentIds = (team.agentIds || []).map((firebaseUid: string) => {
            return userIdMap.get(firebaseUid) || firebaseUid;
          });

          const existing = await prisma.competitionTeam.findUnique({
            where: { id: team.id }
          });

          if (existing) {
            await prisma.competitionTeam.update({
              where: { id: team.id },
              data: {
                name: team.name,
                agentIds: mappedAgentIds,
                emoji: team.emoji || null,
              }
            });
            updated++;
          } else {
            await prisma.competitionTeam.create({
              data: {
                id: team.id,
                competitionId: comp.id,
                name: team.name,
                agentIds: mappedAgentIds,
                emoji: team.emoji || null,
              }
            });
            imported++;
          }
        } catch (error) {
          console.error(`Error syncing team ${team.id}:`, error);
          errors++;
        }
      }
    }

    return { collection: 'competitionTeams', imported, updated, errors };
  },

  async syncCompetitionRules(competitions: any[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!competitions || competitions.length === 0) {
      return { collection: 'competitionRules', imported, updated, errors };
    }

    for (const comp of competitions) {
      const rules = comp.rules || [];
      
      for (const rule of rules) {
        try {
          const existing = await prisma.competitionRule.findUnique({
            where: { id: rule.id }
          });

          // Map rule type to checkbox
          const isCheckbox = rule.type === 'checkbox';

          if (existing) {
            await prisma.competitionRule.update({
              where: { id: rule.id },
              data: {
                title: rule.name || '',
                points: rule.points || 0,
                isCheckbox,
                emoji: rule.emoji || null,
              }
            });
            updated++;
          } else {
            await prisma.competitionRule.create({
              data: {
                id: rule.id,
                competitionId: comp.id,
                title: rule.name || '',
                points: rule.points || 0,
                isCheckbox,
                emoji: rule.emoji || null,
              }
            });
            imported++;
          }
        } catch (error) {
          console.error(`Error syncing rule ${rule.id}:`, error);
          errors++;
        }
      }
    }

    return { collection: 'competitionRules', imported, updated, errors };
  },

  async syncTrackerKpis(trackers: any[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!trackers || trackers.length === 0) {
      return { collection: 'trackerKpis', imported, updated, errors };
    }

    for (const tracker of trackers) {
      try {
        const existing = await prisma.trackerKpi.findUnique({
          where: { id: tracker.id }
        });

        if (existing) {
          await prisma.trackerKpi.update({
            where: { id: tracker.id },
            data: {
              name: tracker.name,
              unit: tracker.unit || '',
              targetValue: tracker.target || 0,
              campaignId: tracker.campaignId || null,
            }
          });
          updated++;
        } else {
          await prisma.trackerKpi.create({
            data: {
              id: tracker.id,
              name: tracker.name,
              unit: tracker.unit || '',
              targetValue: tracker.target || 0,
              campaignId: tracker.campaignId || null,
            }
          });
          imported++;
        }
      } catch (error) {
        console.error(`Error syncing tracker ${tracker.id}:`, error);
        errors++;
      }
    }

    return { collection: 'trackerKpis', imported, updated, errors };
  },

  async syncTrackerLogs(trackerLogs: any[], userIdMap: UserIdMap): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!trackerLogs || trackerLogs.length === 0) {
      return { collection: 'trackerLogs', imported, updated, errors };
    }

    for (const log of trackerLogs) {
      try {
        // Map userId from Firebase UID to Database ID
        const mappedUserId = log.userId ? userIdMap.get(log.userId) || null : null;

        const existing = await prisma.trackerLog.findUnique({
          where: { id: log.id }
        });

        if (existing) {
          await prisma.trackerLog.update({
            where: { id: log.id },
            data: {
              value: log.value,
              userId: mappedUserId,
              loggedAt: log.loggedAt ? new Date(log.loggedAt) : new Date(),
            }
          });
          updated++;
        } else {
          await prisma.trackerLog.create({
            data: {
              id: log.id,
              trackerKpiId: log.trackerKpiId,
              userId: mappedUserId,
              value: log.value,
              loggedAt: log.loggedAt ? new Date(log.loggedAt) : new Date(),
            }
          });
          imported++;
        }
      } catch (error) {
        console.error(`Error syncing tracker log ${log.id}:`, error);
        errors++;
      }
    }

    return { collection: 'trackerLogs', imported, updated, errors };
  },

  async syncAchievements(achievements: any[], userIdMap: UserIdMap): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    if (!achievements || achievements.length === 0) {
      return { collection: 'achievements', imported, updated, errors };
    }

    for (const achievement of achievements) {
      try {
        // Map agentId and loggedBy from Firebase UIDs to Database IDs
        // Use original Firebase UID if no mapping exists (for fresh install)
        const mappedAgentId = achievement.agentId ? 
          (userIdMap.get(achievement.agentId) || achievement.agentId) : 
          achievement.agentId;
        const mappedLoggedBy = achievement.loggedBy ? 
          (userIdMap.get(achievement.loggedBy) || achievement.loggedBy) : 
          achievement.loggedBy;

        // Find existing by composite key
        const existing = await prisma.dailyAchievement.findFirst({
          where: {
            competitionId: achievement.competitionId,
            agentId: mappedAgentId || undefined,
            ruleId: achievement.ruleId,
            date: achievement.date ? new Date(achievement.date) : undefined,
          }
        });

        if (existing) {
          await prisma.dailyAchievement.update({
            where: { id: existing.id },
            data: {
              value: achievement.value,
              points: achievement.points,
              ruleName: achievement.ruleName,
              podId: achievement.podId,
              loggedBy: mappedLoggedBy,
              loggedAt: achievement.loggedAt ? new Date(achievement.loggedAt) : new Date(),
            }
          });
          updated++;
        } else {
          await prisma.dailyAchievement.create({
            data: {
              id: achievement.id,
              competitionId: achievement.competitionId,
              agentId: mappedAgentId,
              podId: achievement.podId,
              ruleId: achievement.ruleId,
              ruleName: achievement.ruleName,
              value: achievement.value,
              points: achievement.points,
              date: achievement.date ? new Date(achievement.date) : new Date(),
              loggedBy: mappedLoggedBy,
              loggedAt: achievement.loggedAt ? new Date(achievement.loggedAt) : new Date(),
            }
          });
          imported++;
        }
      } catch (error) {
        console.error(`Error syncing achievement ${achievement.id}:`, error);
        errors++;
      }
    }

    return { collection: 'achievements', imported, updated, errors };
  },

  async syncPodMemberships(users: any[], userIdMap: UserIdMap): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    if (!users || users.length === 0) {
      return { collection: 'podMemberships', imported, updated: skipped, errors };
    }

    for (const user of users) {
      try {
        // Get the database ID for this user
        const dbId = userIdMap.get(user.uid);
        if (!dbId) {
          skipped++;
          continue;
        }

        // If user has a podId, create membership
        if (user.podId) {
          const existing = await prisma.podMembership.findFirst({
            where: {
              podId: user.podId,
              userId: dbId,
            }
          });

          if (!existing) {
            await prisma.podMembership.create({
              data: {
                podId: user.podId,
                userId: dbId,
              }
            });
            imported++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error syncing membership for user ${user.id}:`, error);
        errors++;
      }
    }

    return { collection: 'podMemberships', imported, updated: skipped, errors };
  },

  async uploadExport(fileContent: string): Promise<{ success: boolean; error?: string }> {
    try {
      const parsed = JSON.parse(fileContent);
      
      if (!parsed.users && !parsed.competitions && !parsed.pods) {
        return { success: false, error: 'Invalid export file format' };
      }

      const tempPath = path.join(process.cwd(), 'temp_uploaded_export.json');
      fs.writeFileSync(tempPath, fileContent);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to parse JSON: ${error}` };
    }
  },

  async getImportLogs(limit: number = 10) {
    return prisma.importLog.findMany({
      orderBy: { importedAt: 'desc' },
      take: limit,
    });
  },

  /**
   * Clear all data from tables (for fresh import testing)
   * WARNING: This deletes all data!
   */
  async clearAllData() {
    console.log('Clearing all data...');
    
    await prisma.dailyAchievement.deleteMany();
    console.log('  - Deleted daily achievements');
    
    await prisma.trackerLog.deleteMany();
    console.log('  - Deleted tracker logs');
    
    await prisma.trackerKpi.deleteMany();
    console.log('  - Deleted tracker KPIs');
    
    await prisma.competitionScoreLog.deleteMany();
    console.log('  - Deleted competition score logs');
    
    await prisma.competitionEntry.deleteMany();
    console.log('  - Deleted competition entries');
    
    await prisma.competitionTeam.deleteMany();
    console.log('  - Deleted competition teams');
    
    await prisma.competitionRule.deleteMany();
    console.log('  - Deleted competition rules');
    
    await prisma.competition.deleteMany();
    console.log('  - Deleted competitions');
    
    await prisma.podMembership.deleteMany();
    console.log('  - Deleted pod memberships');
    
    await prisma.pod.deleteMany();
    console.log('  - Deleted pods');
    
    await prisma.campaign.deleteMany();
    console.log('  - Deleted campaigns');
    
    // Don't delete users - we need to keep at least one admin user
    // await prisma.user.deleteMany();
    // console.log('  - Deleted users');
    
    console.log('Data clearing complete!');
  },

  /**
   * Import directly from Firebase Firestore using Firebase Admin SDK
   * Uses child_process to run the import script as a separate Node process
   * This avoids module loading issues with firebase-admin in Next.js
   */
  async syncFromFirebase(serviceAccountJson: string): Promise<{ results: ImportResult[]; duration: number; success: boolean; error?: string }> {
    console.log('[Firebase Import] Starting Firebase import...');
    console.log('[Firebase Import] Service account length:', serviceAccountJson?.length);
    
    const debugLogPath = path.join(process.cwd(), 'firebase_import_log.txt');
    const startTime = Date.now();
    
    // Write start marker to debug log
    fs.writeFileSync(debugLogPath, `=== Firebase Import Started at ${new Date().toISOString()} ===\n`);
    
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      // Write service account to temp file
      const tempCredPath = path.join(process.cwd(), 'temp_firebase_creds.json');
      fs.writeFileSync(tempCredPath, serviceAccountJson);
      console.log('[Firebase Import] Wrote temp credentials to:', tempCredPath);
      
      const child = spawn('npx', ['tsx', 'scripts/import-from-firebase.ts', tempCredPath], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          FIREBASE_CREDS_PATH: tempCredPath,
          NPM_CONFIG_LOGLEVEL: 'error',
          npm_config_loglevel: 'error'
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        // Log to file
        fs.appendFileSync(debugLogPath, chunk);
        // Log to console
        const lines = chunk.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          if (!line.includes('---RESULT_JSON')) {
            console.log('[Firebase Import]', line.trim());
          }
        });
      });
      
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        fs.appendFileSync(debugLogPath, `[ERROR] ${text}`);
        console.log('[Firebase Import ERROR]', text.trim());
      });
      
      child.on('close', (code: number) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempCredPath);
        } catch (e) {}
        
        if (code === 0) {
          try {
            // Find JSON between markers - use lastIndexOf to handle multiple occurrences
            const startMarker = '---RESULT_JSON_START---';
            const endMarker = '---RESULT_JSON_END---';
            const startIdx = stdout.lastIndexOf(startMarker);
            const endIdx = stdout.lastIndexOf(endMarker);
            
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
              let jsonStr = stdout.substring(startIdx + startMarker.length, endIdx).trim();
              // Clean up any trailing content that might break JSON parsing
              jsonStr = jsonStr.replace(/,\s*$/, '').replace(/\}\s*$/, '}');
              const result = JSON.parse(jsonStr);
              resolve(result);
            } else {
              // Fallback: try to parse last line
              const lines = stdout.trim().split('\n');
              const lastLine = lines[lines.length - 1];
              const result = JSON.parse(lastLine);
              resolve(result);
            }
          } catch (parseError: any) {
            // If parsing fails, try to find any valid JSON object in the output
            try {
              const jsonMatch = stdout.match(/\{[\s\S]*"success"\s*:\s*(true|false)[\s\S]*\}/);
              if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                resolve(result);
              } else {
                // If parsing fails, assume success if exit code is 0
                resolve({
                  results: [{ collection: 'firebase_import', imported: 0, updated: 0, errors: 0 }],
                  duration: 0,
                  success: true,
                });
              }
            } catch {
              // If all parsing fails, assume success if exit code is 0
              resolve({
                results: [{ collection: 'firebase_import', imported: 0, updated: 0, errors: 0 }],
                duration: 0,
                success: true,
              });
            }
          }
        } else {
          resolve({
            results: [],
            duration: 0,
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
        }
        
        // Log completion
        fs.appendFileSync(debugLogPath, `\n=== Import completed in ${Date.now() - startTime}ms ===\n`);
      });
      
      child.on('error', (err: Error) => {
        try {
          fs.unlinkSync(tempCredPath);
        } catch (e) {}
        resolve({
          results: [],
          duration: 0,
          success: false,
          error: err.message
        });
      });
    });
  },
};