import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Competition Data ===\n');

  // Check rules with emojis
  const rulesWithEmoji = await prisma.competitionRule.findMany({
    where: { emoji: { not: null } },
    select: { id: true, title: true, emoji: true, competitionId: true },
  });
  
  console.log(`Rules with emojis: ${rulesWithEmoji.length}`);
  if (rulesWithEmoji.length > 0) {
    rulesWithEmoji.forEach(r => {
      console.log(`  - "${r.title}" (${r.competitionId}): ${r.emoji}`);
    });
  }

  // Check teams with agentIds
  const teamsWithAgents = await prisma.competitionTeam.findMany({
    where: { agentIds: { isEmpty: false } },
    select: { id: true, name: true, emoji: true, agentIds: true, competitionId: true },
  });
  
  console.log(`\nTeams with agents: ${teamsWithAgents.length}`);
  if (teamsWithAgents.length > 0) {
    teamsWithAgents.forEach(t => {
      console.log(`  - "${t.name}" (${t.competitionId}): agents=[${t.agentIds.join(', ')}], emoji=${t.emoji}`);
    });
  }

  // Check all teams
  const allTeams = await prisma.competitionTeam.findMany({
    select: { id: true, name: true, emoji: true, agentIds: true, competitionId: true },
  });
  
  console.log(`\nTotal teams: ${allTeams.length}`);
  const teamsWithEmptyAgents = allTeams.filter(t => t.agentIds.length === 0);
  console.log(`Teams with NO agents: ${teamsWithEmptyAgents.length}`);

  // Check all rules
  const allRules = await prisma.competitionRule.findMany({
    select: { id: true, title: true, emoji: true, competitionId: true },
  });
  
  console.log(`\nTotal rules: ${allRules.length}`);
  const rulesWithNoEmoji = allRules.filter(r => !r.emoji);
  console.log(`Rules with NO emoji: ${rulesWithNoEmoji.length}`);

  // Show sample of some competitions
  const competitions = await prisma.competition.findMany({
    take: 3,
    select: { id: true, name: true, rules: true, teams: true },
  });
  
  console.log('\n=== Sample Competitions ===');
  competitions.forEach(comp => {
    console.log(`\nCompetition: "${comp.name}" (${comp.id})`);
    console.log(`  Rules: ${comp.rules.length}`);
    comp.rules.forEach(r => console.log(`    - "${r.title}": emoji=${r.emoji || '(none)'}`));
    console.log(`  Teams: ${comp.teams.length}`);
    comp.teams.forEach(t => console.log(`    - "${t.name}": agents=${t.agentIds.length}, emoji=${t.emoji || '(none)'}`));
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
