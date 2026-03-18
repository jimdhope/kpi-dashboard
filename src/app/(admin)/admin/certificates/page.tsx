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
import { Download, Loader2, Filter, Award, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';

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
}

const CERTIFICATES_COMPETITION_KEY = 'certificatesPage_selectedCompetitionId';
const CERTIFICATES_POD_KEY = 'certificatesPage_selectedPodId';

export default function CertificateGeneratorPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; companyName?: string; certificatePrimaryColor?: string; certificateSecondaryColor?: string; certificateFontFamily?: string; certificateTagline?: string; certificateFooterText?: string }[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificates, setCertificates] = useState<CertificateEntry[]>([]);
  const [campaignBranding, setCampaignBranding] = useState<{
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    tagline: string;
    footerText: string;
  } | null>(null);
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

  useEffect(() => {
    if (selectedCompetition?.campaignId) {
      const campaign = campaigns.find((c) => c.id === selectedCompetition.campaignId);
      if (campaign) {
        setCampaignBranding({
          companyName: campaign.companyName || 'KPI Quest',
          primaryColor: campaign.certificatePrimaryColor || '#1e40af',
          secondaryColor: campaign.certificateSecondaryColor || '#3b82f6',
          fontFamily: campaign.certificateFontFamily || 'Inter',
          tagline: campaign.certificateTagline || '',
          footerText: campaign.certificateFooterText || '',
        });
      }
    }
  }, [selectedCompetition, campaigns]);

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

      const usersQuery = query(collection(db, 'users'), where('podId', '==', selectedPodId), where('roles', 'array-contains', 'agent'));
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
        if (rule && rule.type === 'numeric') {
          agentScores[log.agentId] = (agentScores[log.agentId] || 0) + (log.value || 0) * (rule.points || 0);
        }
      });

      const teamScores: Record<string, number> = {};
      teams.forEach((t) => { teamScores[t.id] = 0; });
      logs.forEach((log) => {
        const rule = rulesMap.get(log.ruleId);
        if (rule && rule.type === 'numeric') {
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
          });
        }
      });

      rankedTeamsWithRank.filter((t) => t.rank === 1).forEach((t) => {
        const members = (t.team?.agentIds || [])
          .map((id) => podAgents.find((a) => a.id === id)?.name)
          .filter(Boolean) as string[];
        certEntries.push({
          type: 'team',
          name: `${t.team?.emoji || ''} ${t.team?.name || 'Team'}`,
          rank: 1,
          members,
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
        backgroundColor: '#ffffff',
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

  const branding = campaignBranding || {
    companyName: 'KPI Quest',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    fontFamily: 'Inter',
    tagline: '',
    footerText: '',
  };

  return (
    <div className="space-y-6">
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
              <Select value={selectedPodId} onValueChange={handlePodChange} disabled={isLoading || !selectedCompetitionId || availablePods.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={!selectedCompetitionId ? 'Select comp first' : 'Select pod'} />
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
              <Button onClick={handleGenerateCertificates} disabled={!selectedCompetitionId || !selectedPodId || isGenerating} className="w-full">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
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
            <Button variant="outline" onClick={() => certificates.forEach((cert) => downloadCertificate(`${cert.type}-${cert.rank}`))}>
              <Download className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert, index) => (
              <Card key={`${cert.type}-${cert.rank}`} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{cert.name}</CardTitle>
                  <CardDescription>{getRankTitle(cert.rank)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    ref={(el) => {
                      if (el) certificateRefs.current.set(`${cert.type}-${cert.rank}`, el);
                    }}
                    className="relative w-full aspect-[1.414/1] bg-white rounded-lg overflow-hidden p-8 text-center"
                    style={{ fontFamily: branding.fontFamily }}
                  >
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${branding.primaryColor}15 0%, ${branding.secondaryColor}15 100%)` }} />
                    <div className="absolute inset-2 border-4 rounded-lg" style={{ borderColor: cert.type === 'team' ? branding.secondaryColor : branding.primaryColor }} />
                    
                    <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-4">
                      <div className="text-4xl font-bold" style={{ color: branding.primaryColor }}>
                        {cert.type === 'agent' ? 'Certificate of Achievement' : 'Team Achievement Award'}
                      </div>
                      
                      {branding.tagline && (
                        <div className="text-sm" style={{ color: branding.secondaryColor }}>
                          {branding.tagline}
                        </div>
                      )}
                      
                      <div className="text-lg">This certifies</div>
                      
                      <div className="text-3xl font-bold" style={{ color: cert.type === 'agent' ? '#92400e' : branding.secondaryColor }}>
                        {cert.name}
                      </div>
                      
                      {cert.members && cert.members.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Members: {cert.members.join(', ')}
                        </div>
                      )}
                      
                      <div className="text-lg">for achieving</div>
                      
                      <div className="text-4xl font-bold" style={{ color: cert.rank === 1 ? '#ca8a04' : cert.rank === 2 ? '#6b7280' : '#92400e' }}>
                        {getRankTitle(cert.rank)}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        in the {selectedPod?.name} KPI Competition
                      </div>
                      
                      {branding.footerText && (
                        <div className="text-xs text-muted-foreground mt-4">
                          {branding.footerText}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        {branding.companyName}
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={() => downloadCertificate(`${cert.type}-${cert.rank}`)} className="w-full">
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
