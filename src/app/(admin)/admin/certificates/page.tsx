
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
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Placeholder for certificate data structure
interface CertificateData {
    svgContent: string;
    filename: string;
    title: string;
}

// Team structure within Competition
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

             // Fetch Pod Manager details
             let podManager: AppUser | null = null;
             if (pod?.podManagerId) {
                 const podManagerSnap = await getDoc(doc(db, 'users', pod.podManagerId));
                 if (podManagerSnap.exists()) {
                     podManager = { id: podManagerSnap.id, uid: podManagerSnap.id, ...podManagerSnap.data() } as AppUser;
                 } else {
                     console.warn(`Pod manager with ID ${pod.podManagerId} not found.`);
                 }
             }

             if (!competition || !pod) {
                 throw new Error("Could not load competition or pod details.");
             }


            // Fetch Users in the Pod
            const usersQuery = query(collection(db, 'users'), where('podId', '==', selectedPodId), where('roles', 'array-contains', 'agent'));
            const usersSnapshot = await getDocs(usersQuery);
            const podAgentUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() } as AppUser));

            // Fetch Teams for the Competition
            const compDocSnap = await getDoc(doc(db, 'competitions', selectedCompetitionId));
             if (!compDocSnap.exists()) {
                 throw new Error(`Competition with ID ${selectedCompetitionId} not found.`);
             }
            const compData = compDocSnap.data() as Competition & { teams?: Team[] };
             // Ensure teams have IDs, filter teams relevant to this pod's agents
            const competitionTeams = (compData.teams || [])
                 .map((team, index) => ({ ...team, id: team.id || `team-${index}` }))
                 .filter(team =>
                     team.agentIds?.some(agentId => podAgentUsers.some(agent => agent.id === agentId))
                 );

            // Fetch Achievement Logs for the Competition Period and Pod
            const logsQuery = query(
                collection(db, 'dailyAchievements'),
                where('competitionId', '==', selectedCompetitionId),
                where('podId', '==', selectedPodId),
                // Ensure dates are Timestamps for querying
                where('date', '>=', competition.startDate instanceof Timestamp ? competition.startDate : Timestamp.fromDate(competition.startDate)),
                where('date', '<=', competition.endDate instanceof Timestamp ? competition.endDate : Timestamp.fromDate(competition.endDate))
            );
            const logsSnapshot = await getDocs(logsQuery);
            const logs = logsSnapshot.docs.map(doc => doc.data() as DailyAchievementLog);

            // --- Calculate Scores ---
            // Agent Scores
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

            // Team Scores
            const teamScores: { [teamId: string]: number } = {};
            competitionTeams.forEach(team => { teamScores[team.id] = 0; });
            logs.forEach(log => {
                const agentTeam = competitionTeams.find(team => team.agentIds?.includes(log.agentId));
                if (agentTeam) {
                    teamScores[agentTeam.id] += log.points;
                }
            });
            const rankedTeams = competitionTeams
                .map(team => ({ ...team, score: teamScores[team.id] || 0 }))
                .sort((a, b) => b.score - a.score);


            // --- SVG Templates (Updated Circle Text and Centering) ---
            const svgTemplateFirst = `
                <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" style="background-color: #f0f0f0;">
                  <rect x="20" y="20" width="760" height="560" fill="none" stroke="#9f8f5e" stroke-width="15"/>
                  <text x="400" y="100" font-family="Arial, sans-serif" font-size="40" fill="#333" text-anchor="middle" font-weight="bold">Certificate of Achievement</text>
                  <text x="400" y="160" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="400" y="250" font-family="'Brush Script MT', cursive" font-size="50" fill="#9f8f5e" text-anchor="middle" font-weight="bold">{Agent Name}</text>
                  <text x="400" y="320" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="400" y="380" font-family="Arial, sans-serif" font-size="40" fill="#9f8f5e" text-anchor="middle" font-weight="bold">1st Place</text>
                  <text x="400" y="440" font-family="Arial, sans-serif" font-size="20" fill="#555" text-anchor="middle">in the {Pod Name} KPI Competition</text>
                  <line x1="150" y1="530" x2="350" y2="530" stroke="#555" stroke-width="1"/>
                  <line x1="450" y1="530" x2="650" y2="530" stroke="#555" stroke-width="1"/>
                  <text x="250" y="550" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Date: {Date}</text>
                  <text x="550" y="550" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Signed: {Pod Manager Name}</text>
                  {/* Graphic placeholder */}
                  <circle cx="100" cy="100" r="40" fill="#9f8f5e"/>
                   {/* Updated text for 1st Place, centered */}
                  <text x="100" y="100" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">1st</text>
                </svg>`;
             const svgTemplateSecond = `
                <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" style="background-color: #f0f0f0;">
                  <rect x="20" y="20" width="760" height="560" fill="none" stroke="#969696" stroke-width="15"/>
                  <text x="400" y="100" font-family="Arial, sans-serif" font-size="40" fill="#333" text-anchor="middle" font-weight="bold">Certificate of Achievement</text>
                  <text x="400" y="160" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="400" y="250" font-family="'Brush Script MT', cursive" font-size="50" fill="#969696" text-anchor="middle" font-weight="bold">{Agent Name}</text>
                  <text x="400" y="320" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="400" y="380" font-family="Arial, sans-serif" font-size="40" fill="#969696" text-anchor="middle" font-weight="bold">2nd Place</text>
                  <text x="400" y="440" font-family="Arial, sans-serif" font-size="20" fill="#555" text-anchor="middle">in the {Pod Name} KPI Competition</text>
                  <line x1="150" y1="530" x2="350" y2="530" stroke="#555" stroke-width="1"/>
                  <line x1="450" y1="530" x2="650" y2="530" stroke="#555" stroke-width="1"/>
                  <text x="250" y="550" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Date: {Date}</text>
                  <text x="550" y="550" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Signed: {Pod Manager Name}</text>
                  {/* Graphic placeholder */}
                  <circle cx="100" cy="100" r="40" fill="#969696"/>
                  {/* Updated text for 2nd Place, centered */}
                  <text x="100" y="100" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">2nd</text>
                </svg>`;
            const svgTemplateThird = `
                 <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" style="background-color: #f0f0f0;">
                  <rect x="20" y="20" width="760" height="560" fill="none" stroke="#996b4f" stroke-width="15"/>
                  <text x="400" y="100" font-family="Arial, sans-serif" font-size="40" fill="#333" text-anchor="middle" font-weight="bold">Certificate of Achievement</text>
                  <text x="400" y="160" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="400" y="250" font-family="'Brush Script MT', cursive" font-size="50" fill="#996b4f" text-anchor="middle" font-weight="bold">{Agent Name}</text>
                  <text x="400" y="320" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="400" y="380" font-family="Arial, sans-serif" font-size="40" fill="#996b4f" text-anchor="middle" font-weight="bold">3rd Place</text>
                  <text x="400" y="440" font-family="Arial, sans-serif" font-size="20" fill="#555" text-anchor="middle">in the {Pod Name} KPI Competition</text>
                  <line x1="150" y1="530" x2="350" y2="530" stroke="#555" stroke-width="1"/>
                  <line x1="450" y1="530" x2="650" y2="530" stroke="#555" stroke-width="1"/>
                  <text x="250" y="550" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Date: {Date}</text>
                  <text x="550" y="550" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Signed: {Pod Manager Name}</text>
                  {/* Graphic placeholder */}
                  <circle cx="100" cy="100" r="40" fill="#996b4f"/>
                  {/* Updated text for 3rd Place, centered */}
                  <text x="100" y="100" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">3rd</text>
                 </svg>`;
            const svgTemplateTeam = `
                 <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" style="background-color: #e0f2f7;">
                    <rect x="20" y="20" width="760" height="560" fill="none" stroke="#625fc3" stroke-width="15"/>
                    <text x="400" y="100" font-family="Arial, sans-serif" font-size="40" fill="#333" text-anchor="middle" font-weight="bold">Winning Team Award</text>
                    <text x="400" y="160" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">Presented to</text>
                    <text x="400" y="250" font-family="'Brush Script MT', cursive" font-size="50" fill="#625fc3" text-anchor="middle" font-weight="bold">{Team Name}</text>
                    <text x="400" y="320" font-family="Arial, sans-serif" font-size="24" fill="#555" text-anchor="middle">For winning the {Pod Name} KPI Competition</text>
                    <text x="400" y="420" font-family="Arial, sans-serif" font-size="16" fill="#555" text-anchor="middle">Team Members: {Members}</text>
                    <line x1="150" y1="500" x2="350" y2="500" stroke="#555" stroke-width="1"/>
                    <line x1="450" y1="500" x2="650" y2="500" stroke="#555" stroke-width="1"/>
                    <text x="250" y="520" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Date: {Date}</text>
                    <text x="550" y="520" font-family="Arial, sans-serif" font-size="14" fill="#555" text-anchor="middle">Signed: {Pod Manager Name}</text>
                    {/* Trophy graphic placeholder */}
                    <text x="100" y="110" font-family="Arial" font-size="60" text-anchor="middle" fill="#625fc3">🏆</text>
                 </svg>`;

            // --- Replace Placeholders ---
            const generated: CertificateData[] = [];
            const endDateObj = competition.endDate instanceof Timestamp ? competition.endDate.toDate() : competition.endDate;
            const dateStr = format(endDateObj, 'PPP'); // Format end date nicely

             const replacePlaceholders = (template: string, data: Record<string, string>): string => {
                 let result = template;
                 for (const key in data) {
                     // Use a regex that handles curly braces and is case-insensitive for placeholders
                     result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), data[key] || ''); // Replace with empty string if data[key] is undefined
                 }
                 return result;
             };

            // Generate for Top 3 Agents
            for (let i = 0; i < Math.min(3, rankedAgents.length); i++) {
                const agent = rankedAgents[i];
                const rank = i + 1;
                const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd';
                const templateData = {
                    'Agent Name': agent.name,
                    'Pod Name': pod.name,
                    'Pod Manager Name': podManager?.name || 'N/A', // Use fetched name or N/A
                    'Date': dateStr,
                };
                 let svgTemplate = '';
                 if (rank === 1) svgTemplate = svgTemplateFirst;
                 else if (rank === 2) svgTemplate = svgTemplateSecond;
                 else if (rank === 3) svgTemplate = svgTemplateThird;

                generated.push({
                    svgContent: replacePlaceholders(svgTemplate, templateData),
                    filename: `${pod.name}_Agent_${rank}.svg`, // Removed competition name
                    title: `${agent.name} - ${rank}${rankSuffix} Place`
                });
            }

            // Generate for Winning Team
            if (rankedTeams.length > 0) {
                const winningTeam = rankedTeams[0];
                 // Format members list
                 const memberNames = (winningTeam.agentIds || [])
                    .map(id => podAgentUsers.find(u => u.id === id)?.name)
                    .filter((name): name is string => !!name);
                 let membersStr = memberNames.join(', ');
                 if (memberNames.length > 1) {
                     const lastCommaIndex = membersStr.lastIndexOf(',');
                     membersStr = membersStr.substring(0, lastCommaIndex) + ' & ' + membersStr.substring(lastCommaIndex + 1).trim();
                 }

                const teamTemplateData = {
                    'Team Name': winningTeam.name,
                    'Pod Name': pod.name,
                    'Pod Manager Name': podManager?.name || 'N/A', // Use fetched name or N/A
                    'Date': dateStr,
                    'Members': membersStr || 'N/A',
                };
                generated.push({
                    svgContent: replacePlaceholders(svgTemplateTeam, teamTemplateData),
                    filename: `${pod.name}_WinningTeam_${winningTeam.name}.svg`, // Removed competition name
                    title: `Winning Team - ${winningTeam.name}`
                });
            }

            if (generated.length === 0) {
                toast({ variant: "default", title: "No Data", description: "No top performers or winning team found for this selection." });
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
                                     {competitions.length === 0 && !isLoadingCompetitions && <SelectItem value="-" disabled>No competitions found</SelectItem>}
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
                                    <SelectValue placeholder={!selectedCompetitionId ? "Select Comp..." : (isLoadingPods ? "Loading..." : (availablePods.length === 0 ? "No pods in comp" : "Select Pod"))} />
                                </SelectTrigger>
                                <SelectContent>
                                     {!selectedCompetitionId ? (
                                         <SelectItem value="-" disabled>Select competition first</SelectItem>
                                     ) : availablePods.length === 0 ? (
                                         <SelectItem value="-" disabled>No pods in competition</SelectItem>
                                     ) : (
                                         availablePods.map(pod => (
                                             <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                                         ))
                                     )}
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

                     {error && !isLoadingData && ( // Show error only when not loading
                        <div className="text-destructive flex items-center gap-2 mt-4">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                     {isLoadingData && ( // Show skeleton loader
                        <div className="mt-6 space-y-4">
                            <Skeleton className="h-8 w-1/3" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Skeleton className="h-[300px] w-full" />
                                <Skeleton className="h-[300px] w-full" />
                            </div>
                        </div>
                    )}

                    {/* Generated Certificates Display */}
                    {!isLoadingData && generatedCertificates.length > 0 && (
                        <div className="mt-6 space-y-4">
                            <h3 className="text-lg font-semibold">Generated Certificates</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {generatedCertificates.map((cert, index) => (
                                    <Card key={index} className="overflow-hidden shadow-md">
                                        <CardHeader className="p-3 bg-muted/50">
                                            <CardTitle className="text-sm">{cert.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 flex flex-col items-center gap-4">
                                            {/* Render SVG directly with responsive styling */}
                                            <div
                                                className="certificate-svg-container border rounded-md overflow-hidden w-full aspect-[4/3]" // Add class and maintain aspect ratio
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

