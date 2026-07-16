import { activityRepository } from "@/server/repositories/activity-repository";
import { authService } from "@/server/services/auth-service";
import { ActivityType } from "@/lib/contracts";

export const activityService = {
  // ========================================================================
  // Generic logging methods
  // ========================================================================

  async logAgentAction(input: {
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} ${input.title.toLowerCase()}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      recorderId: user.id,
      recorderName: user.name,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
      richMessage,
    });
  },

  async logRecorderAction(input: {
    agentId: string;
    agentName: string;
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const recorder = await authService.requireCurrentUser();
    const richMessage = `${input.agentName} ${input.title.toLowerCase()} - recorded by ${recorder.name}`;
    
    return activityRepository.create({
      userId: input.agentId,
      agentName: input.agentName,
      recorderId: recorder.id,
      recorderName: recorder.name,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
      richMessage,
    });
  },

  // ========================================================================
  // Tracker Activities
  // ========================================================================

  async logTrackerCreated(input: {
    trackerId: string;
    trackerName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} created a new tracker: ${input.trackerName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'tracker_created',
      title: 'Tracker Created',
      description: `Created tracker: ${input.trackerName}`,
      metadata: {
        trackerId: input.trackerId,
        trackerName: input.trackerName,
      },
      richMessage,
    });
  },

  async logTrackerEntryLogged(input: {
    trackerId: string;
    trackerName: string;
    value: number;
    userId?: string;
    userName?: string;
    recorderId?: string;
    recorderName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.recorderId && input.recorderId !== finalUserId
      ? `${finalUserName} logged an entry for ${input.trackerName} - recorded by ${input.recorderName}`
      : `${finalUserName} logged an entry for ${input.trackerName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      recorderId: input.recorderId || null,
      recorderName: input.recorderName || null,
      type: 'tracker_entry_logged',
      title: 'Entry Logged',
      description: `Logged ${input.value} for ${input.trackerName}`,
      metadata: {
        trackerId: input.trackerId,
        trackerName: input.trackerName,
        value: input.value,
        ...(input.recorderId && { recorderId: input.recorderId, recorderName: input.recorderName }),
      },
      richMessage,
    });
  },

  async logTrackerMilestone(input: {
    trackerId: string;
    trackerName: string;
    value: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} reached a milestone in ${input.trackerName}: ${input.value}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'tracker_milestone',
      title: 'Milestone Reached',
      description: `Reached ${input.value} milestone in ${input.trackerName}`,
      metadata: {
        trackerId: input.trackerId,
        trackerName: input.trackerName,
        milestone: input.value,
      },
      richMessage,
    });
  },

  // ========================================================================
  // Competition Activities
  // ========================================================================

  async logCompetitionStarted(input: {
    competitionId: string;
    competitionName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} started ${input.competitionName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_started',
      title: 'Competition Started',
      description: `Started competing in ${input.competitionName}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
      },
      richMessage,
    });
  },

  async logCompetitionJoined(input: {
    competitionId: string;
    competitionName: string;
    teamName?: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.teamName
      ? `${finalUserName} joined ${input.competitionName} (Team: ${input.teamName})`
      : `${finalUserName} joined ${input.competitionName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_joined',
      title: 'Joined Competition',
      description: `Joined ${input.competitionName}${input.teamName ? ` (${input.teamName})` : ''}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
        ...(input.teamName && { teamName: input.teamName }),
      },
      richMessage,
    });
  },

  async logCompetitionCompleted(input: {
    competitionId: string;
    competitionName: string;
    rank?: number;
    finalScore?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.rank
      ? `${finalUserName} completed ${input.competitionName} - Rank #${input.rank}`
      : `${finalUserName} completed ${input.competitionName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_completed',
      title: 'Competition Completed',
      description: `Completed ${input.competitionName}${input.rank ? ` at rank #${input.rank}` : ''}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
        ...(input.rank && { rank: input.rank }),
        ...(input.finalScore !== undefined && { finalScore: input.finalScore }),
      },
      richMessage,
    });
  },

  async logCompetitionWon(input: {
    competitionId: string;
    competitionName: string;
    points?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.points
      ? `${finalUserName} won ${input.competitionName}! (+${input.points} points)`
      : `${finalUserName} won ${input.competitionName}!`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_won',
      title: 'Competition Won!',
      description: `Won ${input.competitionName}${input.points ? ` (+${input.points} points)` : ''}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
        ...(input.points && { points: input.points }),
      },
      richMessage,
    });
  },

  async logCompetitionScoreLogged(input: {
    competitionId: string;
    competitionName: string;
    points: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} logged ${input.points} points in ${input.competitionName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_score_logged',
      title: 'Competition Score Logged',
      description: `Logged ${input.points} points in ${input.competitionName}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
        points: input.points,
      },
      richMessage,
    });
  },

  async logCompetitionMilestone(input: {
    competitionId: string;
    competitionName: string;
    milestone: string;
    points?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} reached a milestone in ${input.competitionName}: ${input.milestone}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_milestone',
      title: 'Competition Milestone',
      description: `Reached ${input.milestone} in ${input.competitionName}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
        milestone: input.milestone,
        ...(input.points && { points: input.points }),
      },
      richMessage,
    });
  },

  async logCompetitionAbsent(input: {
    competitionId: string;
    competitionName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} was absent from ${input.competitionName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'competition_absent',
      title: 'Competition Absent',
      description: `Was absent from ${input.competitionName}`,
      metadata: {
        competitionId: input.competitionId,
        competitionName: input.competitionName,
      },
      richMessage,
    });
  },

  // ========================================================================
  // Score Activities
  // ========================================================================

  async logScoreLogged(input: {
    points: number;
    ruleName?: string;
    value?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.ruleName
      ? `${finalUserName} logged ${input.points} points for ${input.ruleName}`
      : `${finalUserName} logged ${input.points} points`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'score_logged',
      title: 'Score Logged',
      description: `Logged ${input.points} points${input.ruleName ? ` (${input.ruleName})` : ''}`,
      metadata: {
        points: input.points,
        ...(input.ruleName && { ruleName: input.ruleName }),
        ...(input.value && { value: input.value }),
      },
      richMessage,
    });
  },

  async logAchievementEarned(input: {
    achievementName: string;
    points?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.points
      ? `${finalUserName} earned an achievement: ${input.achievementName} (+${input.points} points)`
      : `${finalUserName} earned an achievement: ${input.achievementName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'achievement_earned',
      title: 'Achievement Earned',
      description: `Earned "${input.achievementName}"${input.points ? ` (+${input.points} points)` : ''}`,
      metadata: {
        achievementName: input.achievementName,
        ...(input.points && { points: input.points }),
      },
      richMessage,
    });
  },

  async logMilestoneReached(input: {
    milestoneName: string;
    points?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.points
      ? `${finalUserName} reached milestone: ${input.milestoneName} (+${input.points} points)`
      : `${finalUserName} reached milestone: ${input.milestoneName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'milestone_reached',
      title: 'Milestone Reached',
      description: `Reached ${input.milestoneName}${input.points ? ` (+${input.points} points)` : ''}`,
      metadata: {
        milestoneName: input.milestoneName,
        ...(input.points && { points: input.points }),
      },
      richMessage,
    });
  },

  async logBadgeEarned(input: {
    badgeName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} earned badge: ${input.badgeName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'badge_earned',
      title: 'Badge Earned',
      description: `Earned badge: ${input.badgeName}`,
      metadata: {
        badgeName: input.badgeName,
      },
      richMessage,
    });
  },

  // ========================================================================
  // KPI Activities
  // ========================================================================

  async logKpiCreated(input: {
    kpiId: string;
    kpiName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} created KPI: ${input.kpiName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'kpi_created',
      title: 'KPI Created',
      description: `Created KPI: ${input.kpiName}`,
      metadata: {
        kpiId: input.kpiId,
        kpiName: input.kpiName,
      },
      richMessage,
    });
  },

  async logKpiUpdated(input: {
    kpiId: string;
    kpiName: string;
    previousValue?: number;
    newValue: number;
    targetValue?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.previousValue !== undefined
      ? `${finalUserName} updated KPI ${input.kpiName}: ${input.previousValue} → ${input.newValue}`
      : `${finalUserName} updated KPI ${input.kpiName} to ${input.newValue}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'kpi_updated',
      title: 'KPI Updated',
      description: `Updated ${input.kpiName} to ${input.newValue}`,
      metadata: {
        kpiId: input.kpiId,
        kpiName: input.kpiName,
        ...(input.previousValue !== undefined && { previousValue: input.previousValue }),
        newValue: input.newValue,
        ...(input.targetValue && { targetValue: input.targetValue }),
      },
      richMessage,
    });
  },

  async logKpiGoalReached(input: {
    kpiId: string;
    kpiName: string;
    targetValue?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} reached goal for ${input.kpiName}!`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'kpi_goal_reached',
      title: 'KPI Goal Reached!',
      description: `Reached goal for ${input.kpiName}${input.targetValue ? ` (target: ${input.targetValue})` : ''}`,
      metadata: {
        kpiId: input.kpiId,
        kpiName: input.kpiName,
        ...(input.targetValue && { targetValue: input.targetValue }),
      },
      richMessage,
    });
  },

  async logKpiGoalAchieved(input: {
    kpiId: string;
    kpiName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} achieved KPI goal: ${input.kpiName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'kpi_goal_achieved',
      title: 'KPI Goal Achieved!',
      description: `Achieved KPI goal for ${input.kpiName}`,
      metadata: {
        kpiId: input.kpiId,
        kpiName: input.kpiName,
      },
      richMessage,
    });
  },

  async logKpiTrendImproved(input: {
    kpiId: string;
    kpiName: string;
    improvement?: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.improvement
      ? `${finalUserName}'s KPI trend improved: ${input.kpiName} (${input.improvement})`
      : `${finalUserName}'s KPI trend improved: ${input.kpiName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'kpi_trend_improved',
      title: 'KPI Trend Improved',
      description: `KPI trend improved for ${input.kpiName}${input.improvement ? ` (${input.improvement})` : ''}`,
      metadata: {
        kpiId: input.kpiId,
        kpiName: input.kpiName,
        ...(input.improvement && { improvement: input.improvement }),
      },
      richMessage,
    });
  },

  // ========================================================================
  // Game Activities
  // ========================================================================

  async logGamePlayed(input: {
    gameId: string;
    gameName: string;
    result: 'win' | 'loss' | 'draw';
    score?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const resultText = input.result === 'win' ? 'Won' : input.result === 'loss' ? 'Lost' : 'Drew';
    const richMessage = input.score !== undefined
      ? `${finalUserName} played ${input.gameName} - ${resultText} (Score: ${input.score})`
      : `${finalUserName} played ${input.gameName} - ${resultText}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'game_played',
      title: 'Game Played',
      description: `Played ${input.gameName} - ${resultText}${input.score !== undefined ? ` (Score: ${input.score})` : ''}`,
      metadata: {
        gameId: input.gameId,
        gameName: input.gameName,
        result: input.result,
        ...(input.score !== undefined && { score: input.score }),
      },
      richMessage,
    });
  },

  async logGameWon(input: {
    gameId: string;
    gameName: string;
    score?: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = input.score !== undefined
      ? `${finalUserName} won ${input.gameName}! (Score: ${input.score})`
      : `${finalUserName} won ${input.gameName}!`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'game_won',
      title: 'Game Won!',
      description: `Won ${input.gameName}${input.score !== undefined ? ` (Score: ${input.score})` : ''}`,
      metadata: {
        gameId: input.gameId,
        gameName: input.gameName,
        result: 'win',
        ...(input.score !== undefined && { score: input.score }),
      },
      richMessage,
    });
  },

  async logGameHighScore(input: {
    gameId: string;
    gameName: string;
    score: number;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} set a high score in ${input.gameName}: ${input.score}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'game_high_score',
      title: 'New High Score!',
      description: `Set high score of ${input.score} in ${input.gameName}`,
      metadata: {
        gameId: input.gameId,
        gameName: input.gameName,
        score: input.score,
      },
      richMessage,
    });
  },

  async logGameAchievement(input: {
    gameId: string;
    gameName: string;
    achievementName: string;
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} unlocked achievement in ${input.gameName}: ${input.achievementName}`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'game_achievement',
      title: 'Game Achievement Unlocked',
      description: `Unlocked "${input.achievementName}" in ${input.gameName}`,
      metadata: {
        gameId: input.gameId,
        gameName: input.gameName,
        achievementName: input.achievementName,
      },
      richMessage,
    });
  },

  // ========================================================================
  // Profile Activities
  // ========================================================================

  async logProfileUpdated(input: {
    fieldsUpdated: string[];
    userId?: string;
    userName?: string;
  }) {
    const user = await authService.requireCurrentUser();
    const finalUserId = input.userId || user.id;
    const finalUserName = input.userName || user.name;
    
    const richMessage = `${finalUserName} updated their profile`;
    
    return activityRepository.create({
      userId: finalUserId,
      agentName: finalUserName,
      type: 'profile_updated',
      title: 'Profile Updated',
      description: `Updated: ${input.fieldsUpdated.join(', ')}`,
      metadata: {
        fieldsUpdated: input.fieldsUpdated,
      },
      richMessage,
    });
  },
};
