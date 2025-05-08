'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Download, AlertCircle } from 'lucide-react';
// Import necessary types
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { collection, query, where, getDocs, Timestamp, doc, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Placeholder for certificate data structure
interface CertificateData {
    svgContent: string;
    filename: string;
    title: string;
}

// Placeholder for team structure within Competition
interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

export default function CertificateGenerationPage() {
    const [competitions, setCompetitions] = React.useState<Competition[]>([]);
    const [pods, setPods] = React.useState<Pod[]>([]);
    const [selectedCompetitionId, setSelectedCompetitionId] = React.useState<string>('');
    const [selectedPodId, setSelectedPodId] = React.useState<string>('');
    const [isLoadingCompetitions, setIsLoadingCompetitions] = React.useState(true);
    const [isLoadingPods, setIsLoadingPods] = React.useState(true);
    const [isLoadingData, setIsLoadingData] = React.useState(false); // Loading logs/users/teams
    const [generatedCertificates, setGeneratedCertificates] = React.useState<CertificateData[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const { toast } = useToast();

    // --- Fetch Competitions ---
    React.useEffect(() => {
        setIsLoadingCompetitions(true);
        const compQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
        const unsubscribe = onSnapshot(compQuery, (snapshot) => {
            const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
            setCompetitions(fetchedComps);
            setIsLoadingCompetitions(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching competitions:", err);
            setError("Failed to load competitions.");
            setIsLoadingCompetitions(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Fetch Pods ---
    React.useEffect(() => {
        setIsLoadingPods(true);
        const podQuery = query(collection(db, 'pods'), orderBy('name'));
        const unsubscribe = onSnapshot(podQuery, (snapshot) => {
            const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
            setPods(fetchedPods);
            setIsLoadingPods(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching pods:", err);
            setError("Failed to load pods.");
            setIsLoadingPods(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Filter Pods based on Selected Competition ---
    const availablePods = React.useMemo(() => {
        if (!selectedCompetitionId) return [];
        const competition = competitions.find(c => c.id === selectedCompetitionId);
        if (!competition || !competition.podIds) return [];
        return pods.filter(pod => competition.podIds.includes(pod.id));
    }, [competitions, pods, selectedCompetitionId]);

    // --- Handle Generate Certificates ---
    const handleGenerateCertificates = async () => {
        if (!selectedCompetitionId || !selectedPodId) {
            toast({ variant: "destructive", title: "Selection Required", description: "Please select a competition and a pod." });
            return;
        }

        setIsLoadingData(true);
        setGeneratedCertificates([]);
        setError(null);

        try {
            const competition = competitions.find(c => c.id === selectedCompetitionId);
            const pod = pods.find(p => p.id === selectedPodId);
            const podManager = pod ? (await getDoc(doc(db, 'users', pod.podManagerId))).data() as AppUser : null;

            if (!competition || !pod || !podManager) {
                throw new Error("Could not load competition, pod, or pod manager details.");
            }

            // Fetch Users in the Pod
            const usersQuery = query(collection(db, 'users'), where('podId', '==', selectedPodId));
            const usersSnapshot = await getDocs(usersQuery);
            const podUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
            const podAgentUsers = podUsers.filter(u => u.roles?.includes('agent'));

            // Fetch Teams for the Competition
            const compDocSnap = await getDoc(doc(db, 'competitions', selectedCompetitionId));
            const compData = compDocSnap.exists() ? compDocSnap.data() as Competition & { teams?: Team[] } : null;
            const competitionTeams = compData?.teams?.filter(team =>
                podAgentUsers.some(agent => team.agentIds.includes(agent.id!)) // Filter teams relevant to this pod's agents
            ) || [];

            // Fetch Achievement Logs for the Competition Period and Pod
            const logsQuery = query(
                collection(db, 'dailyAchievements'),
                where('competitionId', '==', selectedCompetitionId),
                where('podId', '==', selectedPodId),
                where('date', '>=', competition.startDate),
                where('date', '<=', competition.endDate)
            );
            const logsSnapshot = await getDocs(logsQuery);
            const logs = logsSnapshot.docs.map(doc => doc.data() as DailyAchievementLog);

            // Calculate Agent Scores
            const agentScores: { [agentId: string]: number } = {};
            podAgentUsers.forEach(agent => { agentScores[agent.id!] = 0; });
            logs.forEach(log => {
                if (agentScores.hasOwnProperty(log.agentId)) {
                    agentScores[log.agentId] += log.points;
                }
            });
            const rankedAgents = podAgentUsers
                .map(agent => ({ ...agent, score: agentScores[agent.id!] || 0 }))
                .sort((a, b) => b.score - a.score);

            // Calculate Team Scores
            const teamScores: { [teamId: string]: number } = {};
            competitionTeams.forEach(team => { teamScores[team.id] = 0; });
            logs.forEach(log => {
                const agentTeam = competitionTeams.find(team => team.agentIds.includes(log.agentId));
                if (agentTeam) {
                    teamScores[agentTeam.id] += log.points;
                }
            });
            const rankedTeams = competitionTeams
                .map(team => ({ ...team, score: teamScores[team.id] || 0 }))
                .sort((a, b) => b.score - a.score);


            // --- Placeholder SVG Generation ---
            // Replace this with actual SVG fetching and replacement later
            const generated: CertificateData[] = [];
            const dateStr = format(competition.endDate.toDate(), 'PPP'); // Format end date nicely

            // Top 3 Agents
            for (let i = 0; i < Math.min(3, rankedAgents.length); i++) {
                const agent = rankedAgents[i];
                const rank = i + 1;
                const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd';
                const templateData = {
                    '{Agent Name}': agent.name,
                    '{Pod Name}': pod.name,
                    '{Pod Manager Name}': podManager.name,
                    '{Competition Name}': competition.name,
                    '{Date}': dateStr,
                    '{Rank}': `${rank}${rankSuffix} Place`
                };
                 // Fetch or define your SVG template string here based on rank (1st, 2nd, 3rd)
                 const svgTemplate = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${rank === 1 ? 'gold' : rank === 2 ? 'silver' : '#cd7f32'}"/>
                 <text x="20" y="40" font-family="Arial" font-size="20" fill="black">CERTIFICATE OF ACHIEVEMENT</text>
                 <text x="20" y="70" font-family="Arial" font-size="16" fill="black">Awarded to: ${templateData['{Agent Name}']}</text>
                 <text x="20" y="90" font-family="Arial" font-size="14" fill="black">For achieving ${templateData['{Rank}']}</text>
                  <text x="20" y="110" font-family="Arial" font-size="14" fill="black">in ${templateData['{Competition Name}']} (${templateData['{Pod Name}']})</text>
                 <text x="20" y="140" font-family="Arial" font-size="12" fill="black">Date: ${templateData['{Date}']}</text>
                 <text x="20" y="160" font-family="Arial" font-size="12" fill="black">Signed: ${templateData['{Pod Manager Name}']}</text>
                 </svg>`; // Example placeholder SVG

                generated.push({
                    svgContent: svgTemplate, // Replace placeholders later
                    filename: `${competition.name}_${pod.name}_Agent_${rank}.svg`,
                    title: `${agent.name} - ${rank}${rankSuffix} Place`
                });
            }

            // Winning Team
            if (rankedTeams.length > 0) {
                const winningTeam = rankedTeams[0];
                const teamTemplateData = {
                    '{Team Name}': winningTeam.name,
                    '{Pod Name}': pod.name,
                    '{Pod Manager Name}': podManager.name,
                    '{Competition Name}': competition.name,
                    '{Date}': dateStr,
                };
                 // Fetch or define your SVG template string here for the winning team
                 const teamSvgTemplate = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="lightblue"/>
                    <text x="20" y="40" font-family="Arial" font-size="20" fill="black">WINNING TEAM CERTIFICATE</text>
                    <text x="20" y="70" font-family="Arial" font-size="16" fill="black">Awarded to: ${teamTemplateData['{Team Name}']}</text>
                     <text x="20" y="90" font-family="Arial" font-size="14" fill="black">For winning ${teamTemplateData['{Competition Name}']} (${teamTemplateData['{Pod Name}']})</text>
                    <text x="20" y="120" font-family="Arial" font-size="12" fill="black">Date: ${teamTemplateData['{Date}']}</text>
                    <text x="20" y="140" font-family="Arial" font-size="12" fill="black">Signed: ${teamTemplateData['{Pod Manager Name}']}</text>
                 </svg>`; // Example placeholder SVG

                generated.push({
                    svgContent: teamSvgTemplate, // Replace placeholders later
                    filename: `${competition.name}_${pod.name}_WinningTeam_${winningTeam.name}.svg`,
                    title: `Winning Team - ${winningTeam.name}`
                });
            }

            setGeneratedCertificates(generated);

        } catch (err: any) {
            console.error("Error generating certificates:", err);
            setError(err.message || "Failed to generate certificates.");
            toast({ variant: "destructive", title: "Generation Failed", description: err.message });
        } finally {
            setIsLoadingData(false);
        }
    };

    // --- Helper to Download SVG ---
    const downloadSvg = (svgContent: string, filename: string) => {
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Generate Certificates</CardTitle>
                    <CardDescription>Select a competition and pod to generate certificates for top performers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Selections */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="competition-select">Competition</Label>
                            <Select
                                value={selectedCompetitionId}
                                onValueChange={(value) => { setSelectedCompetitionId(value); setSelectedPodId(''); setGeneratedCertificates([]); }}
                                disabled={isLoadingCompetitions || isLoadingData}
                            >
                                <SelectTrigger id="competition-select">
                                    <SelectValue placeholder={isLoadingCompetitions ? "Loading..." : "Select Competition"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {competitions.map(comp => (
                                        <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pod-select">Pod</Label>
                            <Select
                                value={selectedPodId}
                                onValueChange={(value) => { setSelectedPodId(value); setGeneratedCertificates([]); }}
                                disabled={isLoadingPods || isLoadingData || !selectedCompetitionId || availablePods.length === 0}
                            >
                                <SelectTrigger id="pod-select">
                                    <SelectValue placeholder={!selectedCompetitionId ? "Select Comp..." : (isLoadingPods ? "Loading..." : "Select Pod")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availablePods.map(pod => (
                                        <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={handleGenerateCertificates}
                                disabled={!selectedCompetitionId || !selectedPodId || isLoadingData || isLoadingCompetitions || isLoadingPods}
                                className="w-full md:w-auto"
                            >
                                {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Generate Certificates
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <div className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    {/* Generated Certificates Display */}
                    {generatedCertificates.length > 0 && (
                        <div className="mt-6 space-y-4">
                            <h3 className="text-lg font-semibold">Generated Certificates</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {generatedCertificates.map((cert, index) => (
                                    <Card key={index} className="overflow-hidden">
                                        <CardHeader className="p-3 bg-muted/50">
                                            <CardTitle className="text-sm">{cert.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 flex flex-col items-center gap-4">
                                            {/* Render SVG directly */}
                                            <div
                                                className="border rounded-md overflow-hidden w-full aspect-[2/1]" // Maintain aspect ratio
                                                dangerouslySetInnerHTML={{ __html: cert.svgContent }}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => downloadSvg(cert.svgContent, cert.filename)}
                                                className="w-full"
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download SVG
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
