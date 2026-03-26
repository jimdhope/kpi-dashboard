import { Prisma, PrismaClient, RoleKey } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface V2User {
  id: string;
  uid: string;
  name: string;
  email: string;
  roles: string[];
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  podId?: string;
}

interface V2Campaign {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

interface V2Pod {
  id: string;
  name: string;
  description?: string;
  campaignId?: string;
  logoUrl?: string;
  logoInitials?: string;
  logoBgColor?: string;
  agentIds?: string[];
  teamLeaderId?: string;
  podManagerId?: string;
  teamsWebhookUrl?: string;
}

interface V2Competition {
  id: string;
  name: string;
  description?: string;
  campaignId?: string;
  podIds?: string[];
  startDate?: string;
  endDate?: string;
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
    type?: string;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
  }>;
}

interface V2TrackerKpi {
  id: string;
  name: string;
  unit?: string;
  targetValue?: number;
  campaignId?: string;
}

interface V2TrackerLog {
  id: string;
  trackerKpiId: string;
  agentId: string;
  value: number;
  date: string;
  loggedAt: string;
}

interface V2DailyAchievement {
  id: string;
  ruleId: string;
  ruleName?: string;
  value: number;
  competitionId: string;
  podId: string;
  date: string;
  agentId: string;
  points?: number;
  loggedBy?: string;
  loggedAt?: string;
}

interface V2DailyTaskLog {
  id: string;
  agentId: string;
  podId?: string;
  competitionId: string;
  taskId: string;
  taskName?: string;
  completed?: boolean;
  date: string;
}

interface V2TeamBonusLog {
  id: string;
  competitionId: string;
  teamId: string;
  teamName?: string;
  podId?: string;
  points: number;
  reason?: string;
  date: string;
  loggedBy?: string;
  loggedAt?: string;
}

interface V2RpsGame {
  id: string;
  userId: string | null;
  userThrow: string;
  opponentThrow: string;
  result: string;
  points?: number;
  timestamp: string;
}

async function loadJson<T>(filename: string): Promise<T> {
  const filePath = path.join(__dirname, 'exports', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filename}, skipping...`);
    return [] as unknown as T;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

async function importRoles() {
  console.log('Importing roles...');
  const roles = [
    { key: 'admin', name: 'Administrator' },
    { key: 'campaignManager', name: 'Campaign Manager' },
    { key: 'podManager', name: 'Pod Manager' },
    { key: 'teamLeader', name: 'Team Leader' },
    { key: 'competitionRunner', name: 'Competition Runner' },
    { key: 'agent', name: 'Agent' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key as RoleKey },
      update: { name: role.name },
      create: { key: role.key as RoleKey, name: role.name },
    });
  }
  console.log('  Done!');
}

async function importUsers(users: V2User[]) {
  console.log(`Importing ${users.length} users...`);
  
  for (const user of users) {
    // Create user with a placeholder password (they'll need to reset)
    const passwordHash = '$2a$10$placeholder.hash.for.migration';
    
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        firebaseUid: user.uid,
        avatarUrl: user.avatarUrl || null,
        avatarInitials: user.avatarInitials || null,
        avatarBgColor: user.avatarBgColor || null,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        firebaseUid: user.uid,
        avatarUrl: user.avatarUrl || null,
        avatarInitials: user.avatarInitials || null,
        avatarBgColor: user.avatarBgColor || null,
      },
    });

    // Get the created user to assign roles
    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    if (dbUser && user.roles) {
      for (const roleKey of user.roles) {
        const role = await prisma.role.findUnique({ where: { key: roleKey as RoleKey } });
        if (role) {
          await prisma.userRole.upsert({
            where: {
              userId_roleId: {
                userId: dbUser.id,
                roleId: role.id,
              },
            },
            update: {},
            create: {
              userId: dbUser.id,
              roleId: role.id,
            },
          });
        }
      }
    }
  }
  console.log('  Done!');
}

async function importCampaigns(campaigns: V2Campaign[]) {
  console.log(`Importing ${campaigns.length} campaigns...`);
  
  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: { id: campaign.id },
      update: {
        name: campaign.name,
        description: campaign.description || null,
        isActive: campaign.isActive ?? true,
      },
      create: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description || null,
        isActive: campaign.isActive ?? true,
      },
    });
  }
  console.log('  Done!');
}

async function importWebhookEndpoints(pods: V2Pod[]) {
  console.log('Importing webhook endpoints...');
  
  const webhookMap = new Map<string, string>();
  const seenUrls = new Set<string>();
  
  for (const pod of pods) {
    if (pod.teamsWebhookUrl && !seenUrls.has(pod.teamsWebhookUrl)) {
      seenUrls.add(pod.teamsWebhookUrl);
      
      await prisma.teamsWebhookEndpoint.upsert({
        where: { id: pod.teamsWebhookUrl },
        update: {},
        create: {
          id: pod.teamsWebhookUrl,
          name: `teamsOut - ${pod.name}`,
          direction: 'outgoing',
          url: pod.teamsWebhookUrl,
          description: `Imported from Firebase for ${pod.name}`,
        },
      });
      webhookMap.set(pod.teamsWebhookUrl, pod.teamsWebhookUrl);
    }
  }
  
  console.log(`  Done! Created ${webhookMap.size} webhook endpoints`);
  return webhookMap;
}

async function importPods(pods: V2Pod[], webhookMap: Map<string, string>, userMap: Map<string, string>) {
  console.log(`Importing ${pods.length} pods...`);
  
  for (const pod of pods) {
    // Warn if leadership IDs don't map to users
    if (pod.teamLeaderId && !userMap.has(pod.teamLeaderId)) {
      console.warn(`  ⚠️ Team leader ${pod.teamLeaderId} not found for pod ${pod.name}`);
    }
    if (pod.podManagerId && !userMap.has(pod.podManagerId)) {
      console.warn(`  ⚠️ Pod manager ${pod.podManagerId} not found for pod ${pod.name}`);
    }

    await prisma.pod.upsert({
      where: { id: pod.id },
      update: {
        name: pod.name,
        description: pod.description || null,
        campaignId: pod.campaignId || null,
        outgoingWebhookId: webhookMap.get(pod.teamsWebhookUrl || '') || null,
        teamLeaderId: userMap.get(pod.teamLeaderId || '') || null,
        podManagerId: userMap.get(pod.podManagerId || '') || null,
      },
      create: {
        id: pod.id,
        name: pod.name,
        description: pod.description || null,
        campaignId: pod.campaignId || null,
        outgoingWebhookId: webhookMap.get(pod.teamsWebhookUrl || '') || null,
        teamLeaderId: userMap.get(pod.teamLeaderId || '') || null,
        podManagerId: userMap.get(pod.podManagerId || '') || null,
      },
    });

    // Create PodMembership records for agentIds
    if (pod.agentIds && pod.agentIds.length > 0) {
      for (const agentId of pod.agentIds) {
        const userId = userMap.get(agentId);
        if (userId) {
          await prisma.podMembership.upsert({
            where: {
              podId_userId: {
                podId: pod.id,
                userId: userId,
              },
            },
            update: {},
            create: { podId: pod.id, userId: userId },
          });
        }
      }
    }
  }
  console.log('  Done!');
}

async function importCompetitions(competitions: V2Competition[]) {
  console.log(`Importing ${competitions.length} competitions...`);
  
  for (const comp of competitions) {
    // Create competition
    await prisma.competition.upsert({
      where: { id: comp.id },
      update: {
        name: comp.name,
        description: comp.description || null,
        startsAt: comp.startDate ? new Date(comp.startDate) : null,
        endsAt: comp.endDate ? new Date(comp.endDate) : null,
        campaignId: comp.campaignId || null,
        podIds: comp.podIds || [],
      },
      create: {
        id: comp.id,
        name: comp.name,
        description: comp.description || null,
        startsAt: comp.startDate ? new Date(comp.startDate) : null,
        endsAt: comp.endDate ? new Date(comp.endDate) : null,
        campaignId: comp.campaignId || null,
        podIds: comp.podIds || [],
      },
    });

    // RECREATE rules with all fields (using upsert for shared rule IDs)
    if (comp.rules) {
      for (const rule of comp.rules) {
        await prisma.competitionRule.upsert({
          where: { id: rule.id },
          update: {
            competitionId: comp.id,
            title: rule.name,
            points: rule.points,
            emoji: rule.emoji || null,
            isCheckbox: rule.type === 'checkbox',
          },
          create: {
            id: rule.id,
            competitionId: comp.id,
            title: rule.name,
            points: rule.points,
            emoji: rule.emoji || null,
            isCheckbox: rule.type === 'checkbox',
          },
        });
      }
    }

    // RECREATE teams with all fields
    // Note: Teams are now cleared at the beginning of the function
    if (comp.teams) {
      for (const team of comp.teams) {
        await prisma.competitionTeam.upsert({
          where: { id: team.id },
          update: {
            competitionId: comp.id,
            name: team.name,
            agentIds: team.agentIds || [],
            emoji: team.emoji || null,
          },
          create: {
            id: team.id,
            competitionId: comp.id,
            name: team.name,
            agentIds: team.agentIds || [],
            emoji: team.emoji || null,
          },
        });
      }
    }
  }
  console.log('  Done!');
}

async function importTrackerKpis(kpis: V2TrackerKpi[]) {
  console.log(`Importing ${kpis.length} tracker KPIs...`);
  
  for (const kpi of kpis) {
    await prisma.trackerKpi.upsert({
      where: { id: kpi.id },
      update: {
        name: kpi.name,
        unit: kpi.unit || null,
        targetValue: kpi.targetValue ? new Prisma.Decimal(kpi.targetValue) : null,
        campaignId: kpi.campaignId || null,
      },
      create: {
        id: kpi.id,
        name: kpi.name,
        unit: kpi.unit || null,
        targetValue: kpi.targetValue ? new Prisma.Decimal(kpi.targetValue) : null,
        campaignId: kpi.campaignId || null,
      },
    });
  }
  console.log('  Done!');
}

async function importTrackerLogs(logs: V2TrackerLog[], userMap: Map<string, string>) {
  console.log(`Importing ${logs.length} tracker logs...`);
  
  let count = 0;
  for (const log of logs) {
    try {
      const userId = userMap.get(log.agentId) || null;
      await prisma.trackerLog.create({
        data: {
          id: log.id,
          trackerKpiId: log.trackerKpiId,
          userId: userId,
          value: log.value,
          loggedAt: new Date(log.date),
        },
      });
      count++;
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log(`  Done! (${count} imported)`);
}

async function importDailyAchievements(achievements: V2DailyAchievement[], userMap: Map<string, string>) {
  console.log(`Importing ${achievements.length} daily achievements...`);
  
  let count = 0;
  for (const ach of achievements) {
    try {
      const userId = userMap.get(ach.agentId);
      if (!userId) continue;
      await prisma.dailyAchievement.create({
        data: {
          id: ach.id,
          competitionId: ach.competitionId,
          agentId: userId,
          podId: ach.podId,
          ruleId: ach.ruleId,
          ruleName: ach.ruleName || null,
          value: ach.value,
          points: ach.points || ach.value,
          date: new Date(ach.date),
          loggedBy: ach.loggedBy || null,
          loggedAt: ach.loggedAt ? new Date(ach.loggedAt) : null,
        },
      });
      count++;
      if (count % 1000 === 0) {
        console.log(`  Progress: ${count}/${achievements.length}`);
      }
    } catch (error) {
      // Skip duplicates or errors
    }
  }
  console.log(`  Done! (${count} imported)`);
}

async function importDailyTaskLogs(logs: V2DailyTaskLog[], userMap: Map<string, string>) {
  console.log(`Importing ${logs.length} daily task logs...`);
  
  let count = 0;
  for (const log of logs) {
    try {
      const userId = userMap.get(log.agentId);
      if (!userId) continue;
      await prisma.dailyTaskLog.create({
        data: {
          id: log.id,
          competitionId: log.competitionId,
          agentId: userId,
          podId: log.podId || null,
          taskId: log.taskId,
          taskName: log.taskName || null,
          completed: log.completed ?? false,
          date: new Date(log.date),
        },
      });
      count++;
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log(`  Done! (${count} imported)`);
}

async function importTeamBonusLogs(logs: V2TeamBonusLog[]) {
  console.log(`Importing ${logs.length} team bonus logs...`);
  
  for (const log of logs) {
    try {
      await prisma.teamBonusLog.create({
        data: {
          id: log.id,
          competitionId: log.competitionId,
          teamId: log.teamId,
          teamName: log.teamName || null,
          podId: log.podId || null,
          points: log.points,
          reason: log.reason || null,
          date: new Date(log.date),
          loggedBy: log.loggedBy || null,
          loggedAt: log.loggedAt ? new Date(log.loggedAt) : null,
        },
      });
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log('  Done!');
}

async function importRpsGames(games: V2RpsGame[], userMap: Map<string, string>) {
  console.log(`Importing ${games.length} RPS games...`);
  
  let count = 0;
  for (const game of games) {
    try {
      if (!game.userId) continue;
      const playerId = userMap.get(game.userId);
      if (!playerId) continue;
      await prisma.rpsGame.create({
        data: {
          id: game.id,
          playerId: playerId,
          playerThrow: game.userThrow,
          opponentThrow: game.opponentThrow,
          result: game.result,
          points: game.points || 0,
          createdAt: new Date(game.timestamp),
        },
      });
      count++;
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log(`  Done! (${count} imported)`);
}

async function main() {
  console.log('\n=== Firebase to V3 PostgreSQL Import ===\n');

  try {
    // Load all JSON files
    console.log('Loading JSON files...');
    const users = await loadJson<V2User[]>('users.json');
    const campaigns = await loadJson<V2Campaign[]>('campaigns.json');
    const pods = await loadJson<V2Pod[]>('pods.json');
    const competitions = await loadJson<V2Competition[]>('competitions.json');
    const trackerKpis = await loadJson<V2TrackerKpi[]>('trackerKpis.json');
    const trackerLogs = await loadJson<V2TrackerLog[]>('trackerLogs.json');
    const dailyAchievements = await loadJson<V2DailyAchievement[]>('dailyAchievements.json');
    const dailyTaskLogs = await loadJson<V2DailyTaskLog[]>('dailyTaskLogs.json');
    const teamBonusLogs = await loadJson<V2TeamBonusLog[]>('teamBonusLogs.json');
    const rpsGames = await loadJson<V2RpsGame[]>('rpsGames.json');
    console.log('  All files loaded!\n');

    // Import in order (respecting dependencies)
    await importRoles();
    await importCampaigns(campaigns);
    
    // Import webhook endpoints BEFORE pods (needed for pod.outgoingWebhookId)
    const webhookMap = await importWebhookEndpoints(pods);
    
    await importUsers(users);
    
    // Build lookup maps AFTER users are imported
    console.log('Building lookup maps...');
    const userMap = new Map<string, string>();
    const dbUsers = await prisma.user.findMany({ select: { id: true, firebaseUid: true } });
    for (const user of dbUsers) {
      if (user.firebaseUid) {
        userMap.set(user.firebaseUid, user.id);
      }
    }
    console.log(`  User map: ${userMap.size} entries\n`);
    
    // Clear existing PodMemberships (broken IDs) before re-importing
    console.log('Clearing existing PodMemberships...');
    const deletedMemberships = await prisma.podMembership.deleteMany({});
    console.log(`  Deleted ${deletedMemberships.count} existing memberships\n`);
    
    // Clear ALL competition rules and teams BEFORE re-importing
    // (There may be duplicate rule IDs across competitions from previous runs)
    console.log('Clearing existing competition rules and teams...');
    const deletedRules = await prisma.competitionRule.deleteMany({});
    const deletedTeams = await prisma.competitionTeam.deleteMany({});
    console.log(`  Deleted ${deletedRules.count} rules and ${deletedTeams.count} teams\n`);
    
    // Import pods with webhook links, leadership IDs, and memberships
    await importPods(pods, webhookMap, userMap);
    
    await importCompetitions(competitions);
    await importTrackerKpis(trackerKpis);
    await importTrackerLogs(trackerLogs, userMap);
    await importDailyAchievements(dailyAchievements, userMap);
    await importDailyTaskLogs(dailyTaskLogs, userMap);
    await importTeamBonusLogs(teamBonusLogs);
    await importRpsGames(rpsGames, userMap);

    console.log('\n=== Import Complete! ===\n');

    // Print summary
    const summary = {
      roles: await prisma.role.count(),
      users: await prisma.user.count(),
      campaigns: await prisma.campaign.count(),
      pods: await prisma.pod.count(),
      competitionRules: await prisma.competitionRule.count(),
      competitionTeams: await prisma.competitionTeam.count(),
      podMemberships: await prisma.podMembership.count(),
      competitions: await prisma.competition.count(),
      trackerKpis: await prisma.trackerKpi.count(),
      trackerLogs: await prisma.trackerLog.count(),
      dailyAchievements: await prisma.dailyAchievement.count(),
      dailyTaskLogs: await prisma.dailyTaskLog.count(),
      teamBonusLogs: await prisma.teamBonusLog.count(),
      rpsGames: await prisma.rpsGame.count(),
    };

    console.log('Database Summary:');
    console.table(summary);

  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
