'use client';

import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Award, Trophy, Archive, Users, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

interface Pod {
  id: string;
  name: string;
  campaignId?: string | null;
  members?: Array<{
    id: string;
    name: string;
    email: string;
    roles: string[];
  }>;
}

interface Competition {
  id: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  campaignId?: string | null;
  podIds?: string[];
  rules?: Array<{
    id: string;
    title: string;
    points: number;
    isCheckbox?: boolean;
  }>;
  teams?: Array<{
    id: string;
    name: string;
  }>;
}

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  podIds?: string[];
}

interface Achievement {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  value: number;
  points: number;
  date: string;
}

interface CertificateEntry {
  type: 'agent' | 'team';
  id: string;
  name: string;
  rank: number;
  score: number;
  members?: string[];
  competitionName?: string;
  podName?: string;
}

const CERTIFICATES_COMPETITION_KEY = 'certificatesPage_selectedCompetitionId';
const CERTIFICATES_POD_KEY = 'certificatesPage_selectedPodId';

// Certificate preview - fetches actual certificate from API
function CertificatePreview({ 
  cert,
  date,
  managerName,
}: { 
  cert: CertificateEntry;
  date: string;
  managerName?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [src, setSrc] = useState('');
  
  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      rank: cert.rank.toString(),
      name: cert.name,
      podName: cert.podName || '',
      date: date,
      competitionName: cert.competitionName || '',
      isTeam: cert.type === 'team' ? 'true' : 'false',
      managerName: managerName || '',
    });
    if (cert.members && cert.members.length > 0) {
      params.set('members', cert.members.join(','));
    }
    return `/api/certificate?${params.toString()}`;
  }, [cert, date, managerName]);
  
  useEffect(() => {
    setLoading(true);
    setError(false);
    setSrc(previewUrl);
  }, [previewUrl]);
  
  const handleLoad = () => {
    setLoading(false);
  };
  
  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <div className="relative w-full bg-[#111621] rounded-lg overflow-hidden" style={{ aspectRatio: '1200/848' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111621]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading preview...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111621]">
          <div className="flex flex-col items-center gap-2 text-red-400">
            <span className="text-xs">Failed to load preview</span>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); setError(false); setSrc(previewUrl + '&retry=1'); }}>
              Retry
            </Button>
          </div>
        </div>
      )}
      <img
        src={src}
        alt="Certificate preview"
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover ${loading || error ? 'hidden' : ''}`}
      />
    </div>
  );
}

export default function CompetitionCertificatesPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [certificates, setCertificates] = useState<CertificateEntry[]>([]);
  const [podManagers, setPodManagers] = useState<Map<string, string>>(new Map());
  const [selectedManagerName, setSelectedManagerName] = useState<string>('');
  const [managerOptions, setManagerOptions] = useState<Array<{ id: string; name: string }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    const savedCompetitionId = localStorage.getItem(CERTIFICATES_COMPETITION_KEY);
    if (savedCompetitionId) setSelectedCompetitionId(savedCompetitionId);
    const savedPodId = localStorage.getItem(CERTIFICATES_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [compsRes, podsRes, usersRes, achievementsRes] = await Promise.all([
          fetch('/api/competitions'),
          fetch('/api/pods'),
          fetch('/api/users'),
          fetch('/api/achievements'),
        ]);

        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
        }
        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
          
          // Build pod-to-manager map from pods' members (for auto-selection)
          const managersMap = new Map<string, string>();
          
          data.pods?.forEach((pod: Pod) => {
            const manager = pod.members?.find(m => m.roles?.includes('podManager'));
            if (manager) {
              managersMap.set(pod.id, manager.name);
            }
          });
          
          setPodManagers(managersMap);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
          
          // Get ALL pod managers from users (for dropdown)
          const allPodManagers: Array<{ id: string; name: string }> = (data.users || [])
            .filter((u: User) => u.roles?.includes('podManager'))
            .map((u: User) => ({ id: u.id, name: u.name || 'Unknown' }));
          
          allPodManagers.sort((a, b) => a.name.localeCompare(b.name));
          setManagerOptions(allPodManagers);
        }
        if (achievementsRes.ok) {
          const data = await achievementsRes.json();
          setAchievements(data.achievements || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const selectedCompetition = competitions.find((c) => c.id === selectedCompetitionId);
  const selectedPod = pods.find((p) => p.id === selectedPodId);

  const availablePods = useMemo(() => {
    if (!selectedCompetition) return [];
    return pods.filter((p) => selectedCompetition.podIds?.includes(p.id));
  }, [selectedCompetition, pods]);

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
    
    const assignedManager = podManagers.get(value);
    if (assignedManager) {
      setSelectedManagerName(assignedManager);
    } else {
      setSelectedManagerName('');
    }
  };

  const handleGenerateCertificates = async () => {
    if (!selectedCompetitionId || !selectedPodId) return;

    setIsGenerating(true);
    try {
      const competition = competitions.find((c) => c.id === selectedCompetitionId);
      const pod = pods.find((p) => p.id === selectedPodId);

      if (!competition || !pod) throw new Error('Competition or pod not found');

      const rulesMap = new Map((competition.rules || []).map((r) => [r.id, r]));

      // Filter achievements for this competition and pod
      const podAchievements = achievements.filter(
        (a) => a.competitionId === selectedCompetitionId && a.podId === selectedPodId
      );

      // Get agents who are members of this pod (using podIds array)
      const podAgents = users.filter(
        (u) => u.podIds?.includes(selectedPodId) && u.roles?.includes('agent')
      );

      // Calculate scores
      const agentScores: Record<string, number> = {};
      podAgents.forEach((a) => { agentScores[a.id] = 0; });
      podAchievements.forEach((log) => {
        const rule = rulesMap.get(log.ruleId);
        if (rule && !rule.isCheckbox) {
          agentScores[log.agentId] = (agentScores[log.agentId] || 0) + log.value * (rule.points || 0);
        }
      });

      // Rank agents by score
      const rankedAgents = Object.entries(agentScores)
        .map(([id, score]) => ({ id, score, agent: podAgents.find((a) => a.id === id) }))
        .filter((a) => a.agent)
        .sort((a, b) => b.score - a.score);

      // Assign dense ranks
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

      // Create certificate entries for top 3 agents
      const certEntries: CertificateEntry[] = rankedAgentsWithRank
        .filter((a) => a.rank <= 3)
        .map((a) => ({
          type: 'agent' as const,
          id: a.agent!.id,
          name: a.agent!.name || 'Unknown',
          rank: a.rank,
          score: a.score,
          competitionName: competition.name,
          podName: pod.name,
        }));

      // Add team certificate for 1st place if teams exist in competition
      if (competition.teams && competition.teams.length > 0) {
        // Calculate team scores based on member performance
        const teamScores: Record<string, number> = {};
        competition.teams.forEach(team => {
          teamScores[team.id] = 0;
        });

        // Add agent scores to their teams (assuming agents map to teams)
        rankedAgentsWithRank.forEach(a => {
          // Find which team this agent belongs to
          const team = competition.teams?.find(t => 
            a.agent && podAgents.some(pa => pa.id === a.agent!.id)
          );
          if (team) {
            teamScores[team.id] = (teamScores[team.id] || 0) + a.score;
          }
        });

        // Find winning team
        const winningTeamEntry = Object.entries(teamScores)
          .map(([id, score]) => ({
            id,
            score,
            team: competition.teams?.find(t => t.id === id)
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (winningTeamEntry && winningTeamEntry.team) {
          // Get team members - top performing agents from the pod who contributed to the team score
          const teamMembers = rankedAgentsWithRank
            .filter(a => a.rank <= 5)
            .map(a => a.agent!.name)
            .filter(Boolean);
          
          certEntries.push({
            type: 'team',
            id: winningTeamEntry.team.id,
            name: winningTeamEntry.team.name,
            rank: 1,
            score: winningTeamEntry.score,
            members: teamMembers,
            competitionName: competition.name,
            podName: pod.name,
          });
        }
      }

      setCertificates(certEntries);
      toast({ title: 'Certificates Ready', description: `${certEntries.length} certificates generated` });
    } catch (error) {
      console.error('Error generating certificates:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate certificates' });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDateShort = (date: Date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const getOrdinalSuffix = (n: number): string => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      if (v >= 11 && v <= 13) return s[0];
      return s[(n % 10) > 3 ? 0 : (n % 10)];
    };
    
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
  };

  const getCertificateUrl = (cert: CertificateEntry) => {
    const params = new URLSearchParams({
      rank: cert.rank.toString(),
      name: cert.name,
      podName: cert.podName || '',
      date: formatDateShort(new Date()),
      competitionName: cert.competitionName || '',
      isTeam: cert.type === 'team' ? 'true' : 'false',
      managerName: selectedManagerName || '',
    });
    
    if (cert.members && cert.members.length > 0) {
      params.set('members', cert.members.join(','));
    }
    
    return `/api/certificate?${params.toString()}`;
  };

  const downloadSingleCertificate = async (cert: CertificateEntry) => {
    const url = getCertificateUrl(cert);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${cert.rank}-${cert.type === 'team' ? 'team' : cert.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not download certificate' });
    }
  };

  const downloadAllCertificates = async () => {
    if (certificates.length === 0) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const date = format(new Date(), 'MMMM-d-yyyy');
      const folderName = `certificates-${date}`;

      const fetchPromises = certificates.map(async (cert) => {
        const url = getCertificateUrl(cert);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        const blob = await response.blob();
        const filename = `${cert.rank}-${cert.type === 'team' ? 'team' : cert.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        zip.file(filename, blob);
      });

      await Promise.all(fetchPromises);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({ title: 'Download Complete', description: `${certificates.length} certificates downloaded as ZIP` });
    } catch (error) {
      console.error('Error creating ZIP:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to download certificates' });
    } finally {
      setIsDownloading(false);
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

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return '#d4af37';
      case 2: return '#a8a8a8';
      case 3: return '#b87333';
      default: return '#666';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

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
            <div className="grid gap-2">
              <Label>Manager</Label>
              <Select
                value={selectedManagerName}
                onValueChange={setSelectedManagerName}
                disabled={isLoading || !selectedPodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managerOptions.map((manager) => (
                    <SelectItem key={manager.id} value={manager.name}>
                      {manager.name}
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
              onClick={downloadAllCertificates}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              Download All (ZIP)
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {certificates.map((cert, index) => (
              <Card key={`${cert.type}-${cert.rank}-${index}`} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cert.type === 'team' ? (
                        <Users className="h-4 w-4" style={{ color: getRankColor(cert.rank) }} />
                      ) : (
                        <User className="h-4 w-4" style={{ color: getRankColor(cert.rank) }} />
                      )}
                      <CardTitle className="text-base">{cert.name}</CardTitle>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded"
                      style={{
                        backgroundColor: `${getRankColor(cert.rank)}20`,
                        color: getRankColor(cert.rank),
                      }}
                    >
                      {getRankTitle(cert.rank)}
                    </span>
                  </div>
                  <CardDescription>
                    {cert.score.toLocaleString()} Points • {cert.podName}
                    {cert.type === 'team' && cert.members && (
                      <span className="block mt-1 text-xs">
                        Members: {cert.members.length}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview */}
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
                    <CertificatePreview cert={cert} date={formatDateShort(new Date())} managerName={selectedManagerName} />
                  </div>

                  {/* Download buttons */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => downloadSingleCertificate(cert)}
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
