import { certificateRepository } from "@/server/repositories/certificate-repository";
import { competitionRepository } from "@/server/repositories/competition-repository";

export interface CertificateTemplateData {
  competitionName: string;
  competitionDescription?: string;
  dateRange?: string;
  winner: {
    rank: number;
    name: string;
    score: number;
    type: 'agent' | 'team' | 'pod';
  }[];
}

export const certificateService = {
  async getCertificateData(competitionId: string, podId?: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Get top agents
    const topAgents = await certificateRepository.getTopAgents(competitionId, 3, podId);
    
    // Get winning team
    const winningTeam = await certificateRepository.getWinningTeam(competitionId);

    // Get date range
    let dateRange: string | undefined;
    if (competition.startsAt && competition.endsAt) {
      const start = competition.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const end = competition.endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dateRange = `${start} - ${end}`;
    }

    const enrichedAgents = topAgents.map((agent, index) => ({
      ...agent,
      competitionName: competition.name,
      dateRange,
    }));

    return {
      competition: {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        startsAt: competition.startsAt?.toISOString(),
        endsAt: competition.endsAt?.toISOString(),
        dateRange,
      },
      topAgents: enrichedAgents,
      winningTeam: winningTeam ? {
        ...winningTeam,
        competitionName: competition.name,
        dateRange,
      } : null,
    };
  },

  async getCertificatesByPod(competitionId: string, podId: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    const pod = await certificateRepository.getPodDetails(podId);
    if (!pod) {
      throw new Error("Pod not found");
    }

    // Get top agents for this pod
    const topAgents = await certificateRepository.getAgentsByPod(competitionId, podId, 3);

    let dateRange: string | undefined;
    if (competition.startsAt && competition.endsAt) {
      const start = competition.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const end = competition.endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dateRange = `${start} - ${end}`;
    }

    const enrichedAgents = topAgents.map((agent, index) => ({
      ...agent,
      competitionName: competition.name,
      podName: pod.name,
      dateRange,
    }));

    return {
      competition: {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        dateRange,
      },
      pod: {
        id: pod.id,
        name: pod.name,
      },
      topAgents: enrichedAgents,
    };
  },

  async generateCertificateHtml(data: {
    rank: number;
    userName: string;
    competitionName: string;
    score: number;
    dateRange?: string;
    podName?: string;
  }): Promise<string> {
    const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
    const rankColor = rankColors[data.rank - 1] || '#4A90D9';
    const rankLabels = ['1st', '2nd', '3rd'];
    const rankLabel = rankLabels[data.rank - 1] || `${data.rank}th`;

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Georgia', serif; 
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .certificate {
      width: 800px;
      height: 600px;
      background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
      border: 8px solid ${rankColor};
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      position: relative;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 2px solid ${rankColor};
      border-radius: 12px;
      pointer-events: none;
    }
    .header {
      font-size: 14px;
      letter-spacing: 4px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .title {
      font-size: 48px;
      color: ${rankColor};
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 18px;
      color: #333;
      margin-bottom: 30px;
    }
    .rank {
      font-size: 72px;
      font-weight: bold;
      color: ${rankColor};
      margin: 20px 0;
    }
    .name {
      font-size: 36px;
      color: #1a1a2e;
      margin: 20px 0;
      font-weight: bold;
    }
    .competition {
      font-size: 24px;
      color: #666;
      margin-bottom: 20px;
    }
    .score {
      font-size: 20px;
      color: #333;
      margin-bottom: 20px;
    }
    .date-range {
      font-size: 14px;
      color: #999;
    }
    .footer {
      position: absolute;
      bottom: 30px;
      left: 0;
      right: 0;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">Certificate of Achievement</div>
    <div class="title">${rankLabel} Place</div>
    <div class="subtitle">This certifies that</div>
    <div class="name">${data.userName}</div>
    <div class="competition">has successfully competed in</div>
    <div class="subtitle" style="font-size: 24px; font-weight: bold;">${data.competitionName}</div>
    ${data.podName ? `<div class="score">Pod: ${data.podName}</div>` : ''}
    <div class="score">Score: ${data.score.toLocaleString()} points</div>
    ${data.dateRange ? `<div class="date-range">${data.dateRange}</div>` : ''}
    <div class="footer">KPI-Quest Competition Platform</div>
  </div>
</body>
</html>
    `.trim();
  },
};
