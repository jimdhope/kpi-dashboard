'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Award, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  campaignId?: string;
  podIds?: string[];
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

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface DailyAchievementLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  date: Timestamp;
  value: number;
  points?: number;
}

interface CertificateEntry {
  type: 'agent' | 'team';
  name: string;
  rank: number;
  members?: string[];
  competitionName?: string;
  podName?: string;
  teamName?: string;
}

const CERTIFICATES_COMPETITION_KEY = 'certificatesPage_selectedCompetitionId';
const CERTIFICATES_POD_KEY = 'certificatesPage_selectedPodId';

function CertificateTemplate({ 
  cert, 
  branding 
}: { 
  cert: CertificateEntry;
  branding: CertificateBranding;
}) {
  const rankColors = {
    1: { primary: '#d4af37', secondary: '#f9e498', name: 'gold' },
    2: { primary: '#c0c0c0', secondary: '#e8e8e8', name: 'silver' },
    3: { primary: '#cd7f32', secondary: '#daa520', name: 'bronze' },
  };

  const rankColor = rankColors[cert.rank as 1 | 2 | 3] || rankColors[1];
  const rankLabel = cert.rank === 1 ? '1st' : cert.rank === 2 ? '2nd' : '3rd';

  return (
    <div
      className="relative w-full max-w-[600px] mx-auto bg-[#111621] rounded-xl overflow-hidden"
      style={{
        fontFamily: "'Manrope', 'Segoe UI', sans-serif",
      }}
    >
      {/* Outer colored border */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          border: '3px solid transparent',
          backgroundImage: `linear-gradient(#111621, #111621), linear-gradient(135deg, ${rankColor.primary} 0%, ${rankColor.secondary} 50%, ${rankColor.primary} 100%)`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      />

      {/* Main content container - portrait layout */}
      <div className="relative w-full p-6 flex flex-col items-center">
        {/* Colored line at top */}
        <div
          className="w-16 h-1 rounded-full mb-4 mt-2"
          style={{
            background: `linear-gradient(135deg, ${rankColor.primary} 0%, ${rankColor.secondary} 50%, ${rankColor.primary} 100%)`,
          }}
        />

        {/* Header Banner */}
        <div
          className="w-full rounded-lg p-4 mb-4 text-center"
          style={{
            background: 'linear-gradient(to bottom, rgba(17, 22, 33, 0.7), rgba(17, 22, 33, 0.95))',
          }}
        >
          <h1
            className="text-white font-black tracking-tight"
            style={{
              fontSize: '20px',
            }}
          >
            {cert.podName} KPI Competition
          </h1>
        </div>

        {/* Main Content */}
        <div className="max-w-md w-full text-center">
          {/* Award label */}
          <p
            className="text-[#64748b] text-[10px] font-semibold uppercase tracking-widest mb-2"
          >
            {cert.type === 'team' ? 'This award is presented to Team' : 'This award is presented to'}
          </p>

          {/* recipient Name */}
          <h2
            className="text-[#f8fafc] font-extrabold pb-3 underline decoration-[rgba(212,175,55,0.3)] underline-offset-3 mb-3"
            style={{
              fontSize: '28px',
            }}
          >
            {cert.name}
          </h2>

          {/* Medal and Rank Section */}
          <div className="flex flex-col items-center py-3">
            {/* Colored divider lines with medal */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5" style={{ backgroundColor: `rgba(${cert.rank === 1 ? '212,175,55' : cert.rank === 2 ? '192,192,192' : '205,127,50'},0.5)` }} />
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${rankColor.primary} 0%, ${rankColor.secondary} 50%, ${rankColor.primary} 100%)`,
                  boxShadow: `0 2px 8px rgba(${cert.rank === 1 ? '212,175,55' : cert.rank === 2 ? '192,192,192' : '205,127,50'}, 0.3)`,
                }}
              >
                <span className="text-[#111621] font-bold text-sm">★</span>
              </div>
              <div className="w-8 h-0.5" style={{ backgroundColor: `rgba(${cert.rank === 1 ? '212,175,55' : cert.rank === 2 ? '192,192,192' : '205,127,50'},0.5)` }} />
            </div>

            {/* Rank */}
            <div className="mb-2">
              <p
                className="italic font-black uppercase"
                style={{
                  color: rankColor.primary,
                  fontSize: '36px',
                  WebkitTextStroke: `1px ${rankColor.secondary}`,
                }}
              >
                {rankLabel}
              </p>
              <div
                className="w-24 h-0.5 rounded-full mx-auto my-1"
                style={{
                  background: `linear-gradient(135deg, ${rankColor.primary} 0%, ${rankColor.secondary} 50%, ${rankColor.primary} 100%)`,
                }}
              />
              <p
                className="font-medium uppercase"
                style={{
                  fontSize: '14px',
                  letterSpacing: '0.05em',
                  color: rankColor.secondary,
                }}
              >
                {cert.competitionName}
              </p>
            </div>
          </div>

          {/* Team Members (for team certificates) */}
          {cert.type === 'team' && cert.members && cert.members.length > 0 && (
            <div className="mb-3">
              <p className="text-[#94a3b8] text-[10px] uppercase tracking-widest mb-1">Team Members</p>
              <p className="text-[#e2e8f0] text-xs">
                {cert.members.join(', ')}
              </p>
            </div>
          )}

          {/* Recognition Quote */}
          <div
            className="pt-3 border-t border-[rgba(148,163,184,0.2)]"
          >
            <p
              className="text-[#94a3b8] italic leading-relaxed text-xs"
            >
              {cert.type === 'team' 
                ? `"Celebrating the team win in the ${cert.competitionName} KPI Competition."`
                : `"In recognition of achieving ${rankLabel.toLowerCase()} place in the ${cert.teamName || ''} ${cert.competitionName} KPI Competition."`
              }
            </p>
          </div>

          {/* Signature Section */}
          <div
            className="grid grid-cols-3 gap-3 pt-4 items-end"
          >
            {/* Pod Manager */}
            <div className="text-center">
              <div className="border-b border-[#475569] pb-1 mb-1">
                <p 
                  className="italic text-[#e2e8f0]" 
                  style={{ fontSize: '11px', fontFamily: "'Caveat', 'Segoe Script', cursive" }}
                >
                  {branding.podManagerName || branding.managerName || 'Team Manager'}
                </p>
              </div>
              <p className="text-[#64748b] text-[8px] font-bold uppercase">Pod Manager</p>
            </div>

            {/* Official Seal */}
            <div className="flex justify-center">
              <div
                className="w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center"
                style={{
                  borderColor: rankColor.primary,
                  backgroundColor: '#111621',
                }}
              >
                <span style={{ color: rankColor.primary, fontSize: '14px' }}>★</span>
                <span
                  className="text-[6px] font-bold uppercase text-center leading-tight"
                  style={{ color: rankColor.primary }}
                >
                  Official<br />Seal
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="text-center">
              <div className="border-b border-[#475569] pb-1 mb-1">
                <p 
                  className="italic text-[#e2e8f0]" 
                  style={{ fontSize: '11px', fontFamily: "'Caveat', 'Segoe Script', cursive" }}
                >
                  {format(new Date(), 'MMM d, yyyy')}
                </p>
              </div>
              <p className="text-[#64748b] text-[8px] font-bold uppercase">Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CertificateBranding {
  companyName: string;
  managerName?: string;
  podManagerName?: string;
}

export default function CompetitionCertificatesPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; companyName?: string; managerName?: string }[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificates, setCertificates] = useState<CertificateEntry[]>([]);
  const certificateRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    const savedCompetitionId = localStorage.getItem(CERTIFICATES_COMPETITION_KEY);
    if (savedCompetitionId) setSelectedCompetitionId(savedCompetitionId);
    const savedPodId = localStorage.getItem(CERTIFICATES_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: (() => void)[] = [];

    const fetchData = async () => {
      try {
        const compQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
        unsubscribes.push(
          onSnapshot(compQuery, (snapshot) => {
            setCompetitions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Competition)));
          })
        );

        const podQuery = query(collection(db, 'pods'), orderBy('name'));
        unsubscribes.push(
          onSnapshot(podQuery, (snapshot) => {
            setPods(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Pod)));
          })
        );

        const campaignQuery = query(collection(db, 'campaigns'), orderBy('name'));
        unsubscribes.push(
          onSnapshot(campaignQuery, (snapshot) => {
            setCampaigns(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          })
        );

        const usersQuery = query(collection(db, 'users'), orderBy('name'));
        unsubscribes.push(
          onSnapshot(usersQuery, (snapshot) => {
            setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
          })
        );
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  const selectedCompetition = competitions.find((c) => c.id === selectedCompetitionId);
  const selectedPod = pods.find((p) => p.id === selectedPodId);

  const availablePods = React.useMemo(() => {
    if (!selectedCompetition) return [];
    return pods.filter((p) => selectedCompetition.podIds?.includes(p.id));
  }, [selectedCompetition, pods]);

  const campaignBranding = React.useMemo(() => {
    const branding: CertificateBranding = { companyName: 'KPI Quest' };
    
    if (selectedCompetition?.campaignId) {
      const campaign = campaigns.find((c) => c.id === selectedCompetition.campaignId);
      if (campaign) {
        branding.companyName = campaign.companyName || 'KPI Quest';
        branding.managerName = campaign.managerName;
      }
    }
    
    if (selectedPodId) {
      const selectedPod = pods.find((p) => p.id === selectedPodId);
      if (selectedPod) {
        const managerId = (selectedPod as any).podManagerId;
        if (managerId) {
          const manager = users.find((u) => u.id === managerId);
          branding.podManagerName = manager?.name || managerId;
        }
      }
    }
    
    return branding;
  }, [selectedCompetition, campaigns, pods, users, selectedPodId]);

  const handleCompetitionChange = (value: string) => {
    setSelectedCompetitionId(value);
    localStorage.setItem(CERTIFICATES_COMPETITION_KEY, value);
    setSelectedPodId('');
    localStorage.removeItem(CERTIFICATES_POD_KEY);
    setCertificates([]);
  };

  const handlePodChange = (value: string) => {
    setSelectedPodId(value);
    localStorage.setItem(CERTIFICATES_POD_KEY, value);
    setCertificates([]);
  };

  const handleGenerateCertificates = async () => {
    if (!selectedCompetitionId || !selectedPodId) return;

    setIsGenerating(true);
    try {
      const competition = competitions.find((c) => c.id === selectedCompetitionId);
      const pod = pods.find((p) => p.id === selectedPodId);

      if (!competition || !pod) throw new Error('Competition or pod not found');

      const compDoc = await getDoc(doc(db, 'competitions', selectedCompetitionId));
      const compData = compDoc.data() as Competition & { teams?: Team[] };
      const teams = compData.teams || [];

      const usersQuery = query(
        collection(db, 'users'),
        where('podId', '==', selectedPodId),
        where('roles', 'array-contains', 'agent')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const podAgents = usersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));

      const rulesMap = new Map((competition.rules || []).map((r) => [r.id, r]));

      const logsQuery = query(
        collection(db, 'dailyAchievements'),
        where('competitionId', '==', selectedCompetitionId),
        where('podId', '==', selectedPodId)
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logs = logsSnapshot.docs.map((d) => d.data() as DailyAchievementLog);

      const agentScores: Record<string, number> = {};
      podAgents.forEach((a) => { agentScores[a.id!] = 0; });
      logs.forEach((log) => {
        const rule = rulesMap.get(log.ruleId);
        if (rule && rule.type !== 'checkbox') {
          agentScores[log.agentId] = (agentScores[log.agentId] || 0) + (log.value || 0) * (rule.points || 0);
        }
      });

      const teamScores: Record<string, number> = {};
      teams.forEach((t) => { teamScores[t.id] = 0; });
      logs.forEach((log) => {
        const rule = rulesMap.get(log.ruleId);
        if (rule && rule.type !== 'checkbox') {
          const agentTeam = teams.find((t) => t.agentIds?.includes(log.agentId));
          if (agentTeam) {
            teamScores[agentTeam.id] = (teamScores[agentTeam.id] || 0) + (log.value || 0) * (rule.points || 0);
          }
        }
      });

      const rankedAgents = Object.entries(agentScores)
        .map(([id, score]) => ({ id, score, agent: podAgents.find((a) => a.id === id) }))
        .filter((a) => a.agent)
        .sort((a, b) => b.score - a.score);

      const rankedTeams = Object.entries(teamScores)
        .map(([id, score]) => ({ id, score, team: teams.find((t) => t.id === id) }))
        .filter((t) => t.team)
        .sort((a, b) => b.score - a.score);

      const certEntries: CertificateEntry[] = [];

      const assignDenseRank = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
        const sorted = [...items].sort((a, b) => b.score - a.score);
        const scoreRankMap = new Map<number, number>();
        let rank = 1;
        sorted.forEach((item) => {
          if (!scoreRankMap.has(item.score)) {
            scoreRankMap.set(item.score, rank++);
          }
        });
        return sorted.map((item) => ({ ...item, rank: scoreRankMap.get(item.score)! }));
      };

      const rankedAgentsWithRank = assignDenseRank(rankedAgents);
      const rankedTeamsWithRank = assignDenseRank(rankedTeams);

      rankedAgentsWithRank.slice(0, 3).forEach((a) => {
        if (a.rank <= 3) {
          certEntries.push({
            type: 'agent',
            name: a.agent?.name || 'Unknown',
            rank: a.rank,
            competitionName: competition.name,
            podName: pod.name,
          });
        }
      });

      rankedTeamsWithRank.filter((t) => t.rank === 1).forEach((t) => {
        certEntries.push({
          type: 'team',
          name: `${t.team?.emoji || ''} ${t.team?.name || 'Team'}`,
          rank: 1,
          members: (t.team?.agentIds || [])
            .map((id) => podAgents.find((a) => a.id === id)?.name)
            .filter(Boolean) as string[],
          competitionName: competition.name,
          podName: pod.name,
          teamName: t.team?.name,
        });
      });

      setCertificates(certEntries);
      toast({ title: 'Certificates Ready', description: `${certEntries.length} certificates generated` });
    } catch (error) {
      console.error('Error generating certificates:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate certificates' });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCertificate = async (key: string) => {
    const element = certificateRefs.current.get(key);
    if (!element) return;

    try {
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#111621',
      });

      const link = document.createElement('a');
      link.download = `certificate-${key}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to download certificate' });
    }
  };

  const getRankTitle = (rank: number) => {
    switch (rank) {
      case 1: return '1st Place';
      case 2: return '2nd Place';
      case 3: return '3rd Place';
      default: return `${rank}th Place`;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Certificates</h1>
        <p className="text-muted-foreground">Generate PNG certificates for top performers</p>
      </div>

      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Generate Certificates
          </CardTitle>
          <CardDescription>
            Select a competition and pod to generate PNG certificates for top performers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Competition</Label>
              <Select value={selectedCompetitionId} onValueChange={handleCompetitionChange} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select competition" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Pod</Label>
              <Select
                value={selectedPodId}
                onValueChange={handlePodChange}
                disabled={isLoading || !selectedCompetitionId || availablePods.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={!selectedCompetitionId ? 'Select comp first' : 'Select pod'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availablePods.map((pod) => (
                    <SelectItem key={pod.id} value={pod.id}>
                      {pod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerateCertificates}
                disabled={!selectedCompetitionId || !selectedPodId || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trophy className="mr-2 h-4 w-4" />
                )}
                Generate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {certificates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Generated Certificates</h3>
            <Button
              variant="outline"
              onClick={() =>
                certificates.forEach((cert) =>
                  downloadCertificate(`${cert.type}-${cert.rank}-${cert.name.replace(/\s+/g, '-').toLowerCase()}`)
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {certificates.map((cert) => (
              <Card key={`${cert.type}-${cert.rank}`} className="overflow-hidden bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{cert.name}</CardTitle>
                  <CardDescription>{getRankTitle(cert.rank)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    ref={(el) => {
                      if (el)
                        certificateRefs.current.set(
                          `${cert.type}-${cert.rank}-${cert.name.replace(/\s+/g, '-').toLowerCase()}`,
                          el
                        );
                    }}
                  >
                    <CertificateTemplate cert={cert} branding={campaignBranding} />
                  </div>

                  <Button
                    onClick={() =>
                      downloadCertificate(
                        `${cert.type}-${cert.rank}-${cert.name.replace(/\s+/g, '-').toLowerCase()}`
                      )
                    }
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PNG
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
