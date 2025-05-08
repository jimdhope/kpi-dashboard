
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

// Define A4 Landscape Dimensions in pixels (approx 300 DPI)
const SVG_WIDTH = 1123; // Width for A4 landscape at 96 DPI (standard screen)
const SVG_HEIGHT = 794; // Height for A4 landscape at 96 DPI


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

    // --- Helper to format names with '&' ---
    const formatNames = (names: string[]): string => {
        if (names.length === 0) return 'N/A';
        if (names.length === 1) return names[0];
        if (names.length === 2) return names.join(' & ');
        // For 3 or more, use commas and '&' before the last name
        const last = names.pop();
        return `${names.join(', ')} & ${last}`;
    };

     // --- Dense Ranking Logic ---
     const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
         if (items.length === 0) return [];

         const sortedItems = [...items].sort((a, b) => b.score - a.score); // Ensure sorted descending
         const scoreRankMap = new Map<number, number>();
         let rankCounter = 1;

         for (const item of sortedItems) {
             if (!scoreRankMap.has(item.score)) {
                 scoreRankMap.set(item.score, rankCounter++);
             }
         }

         return sortedItems.map(item => ({
             ...item,
             rank: scoreRankMap.get(item.score)!
         }));
     };


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
            const agentScoresMap: { [agentId: string]: number } = {};
            podAgentUsers.forEach(agent => { agentScoresMap[agent.id!] = 0; });
            logs.forEach(log => {
                if (agentScoresMap.hasOwnProperty(log.agentId)) {
                    agentScoresMap[log.agentId] += log.points;
                }
            });
            const agentScores = podAgentUsers
                .map(agent => ({ ...agent, score: agentScoresMap[agent.id!] || 0 }))
                .sort((a, b) => b.score - a.score); // Sort descending for ranking

            // Team Scores
            const teamScoresMap: { [teamId: string]: number } = {};
            competitionTeams.forEach(team => { teamScoresMap[team.id] = 0; });
            logs.forEach(log => {
                const agentTeam = competitionTeams.find(team => team.agentIds?.includes(log.agentId));
                if (agentTeam) {
                    teamScoresMap[agentTeam.id] += log.points;
                }
            });
            const teamScores = competitionTeams
                .map(team => ({ ...team, score: teamScoresMap[team.id] || 0 }))
                .sort((a, b) => b.score - a.score); // Sort descending for ranking

            // Assign ranks using dense ranking logic
            const rankedAgents = assignDenseRanks(agentScores);
            const rankedTeams = assignDenseRanks(teamScores);


             // --- SVG Templates (Use Google Font) ---
             // Font Imports for SVG - embedding using <style>
             const svgDefs = `
                 <defs>
                    <style type="text/css">
                         @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&amp;family=Dancing+Script:wght@700&amp;display=swap');
                        /* Use Inter font family */
                        .body-font { font-family: 'Inter', Arial, Helvetica, sans-serif; }
                        .title-font { font-family: 'Inter', Arial, Helvetica, sans-serif; font-weight: 700; }
                        /* Use Dancing Script Google Font for names and signatures */
                        .name-font { font-family: 'Dancing Script', cursive; font-weight: 700; } /* Specify weight */
                        /* Make signatures even larger */
                        .signature-font { font-family: 'Dancing Script', cursive; font-size: 64px; font-weight: 700; } /* Increased size */
                    </style>
                </defs>
             `;

             // Updated Templates with Highlight Colors and Font Families - Adjusted y-coordinates and font-sizes
             // Added seal elements and rank text inside seals
             const sealRadius = 60; // Increased radius for seals
             const sealY = SVG_HEIGHT / 2; // Vertically center the seals
             const sealLeftX = 120; // X position for left seal
             const sealRightX = SVG_WIDTH - 120; // X position for right seal
             const rankTextFontSize = 32; // Font size for the rank text inside the seal

             const svgTemplateFirst = `
                <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                  ${svgDefs}
                  <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0"/>
                  <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="#9f8f5e" stroke-width="15"/> {/* Gold border */}
                  <circle cx="${sealLeftX}" cy="${sealY}" r="${sealRadius}" fill="#9f8f5e"/> {/* Left Seal */}
                  <text x="${sealLeftX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">1st</text> {/* Rank Text inside Left Seal */}
                  <circle cx="${sealRightX}" cy="${sealY}" r="${sealRadius}" fill="#9f8f5e"/> {/* Right Seal */}
                  <text x="${sealRightX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">1st</text> {/* Rank Text inside Right Seal */}
                  <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Certificate of Achievement</text>
                  <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="50%" y="300" class="name-font" font-size="72" fill="#9f8f5e" text-anchor="middle">{{Agent Name}}</text>
                  <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="50%" y="460" class="title-font" font-size="56" fill="#9f8f5e" text-anchor="middle">1st Place</text>
                  <text x="50%" y="530" class="body-font" font-size="24" fill="#555" text-anchor="middle">in the {{Pod Name}} KPI Competition</text>
                  <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                  <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                </svg>`;
             const svgTemplateSecond = `
                <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                  ${svgDefs}
                  <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0"/>
                  <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="#969696" stroke-width="15"/> {/* Silver border */}
                   <circle cx="${sealLeftX}" cy="${sealY}" r="${sealRadius}" fill="#969696"/> {/* Left Seal */}
                   <text x="${sealLeftX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">2nd</text> {/* Rank Text inside Left Seal */}
                  <circle cx="${sealRightX}" cy="${sealY}" r="${sealRadius}" fill="#969696"/> {/* Right Seal */}
                  <text x="${sealRightX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">2nd</text> {/* Rank Text inside Right Seal */}
                  <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Certificate of Achievement</text>
                  <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="50%" y="300" class="name-font" font-size="72" fill="#969696" text-anchor="middle">{{Agent Name}}</text>
                  <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="50%" y="460" class="title-font" font-size="56" fill="#969696" text-anchor="middle">2nd Place</text>
                  <text x="50%" y="530" class="body-font" font-size="24" fill="#555" text-anchor="middle">in the {{Pod Name}} KPI Competition</text>
                  <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                  <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                </svg>`;
            const svgTemplateThird = `
                 <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                    ${svgDefs}
                    <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0"/>
                    <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="#996b4f" stroke-width="15"/> {/* Bronze border */}
                    <circle cx="${sealLeftX}" cy="${sealY}" r="${sealRadius}" fill="#996b4f"/> {/* Left Seal */}
                    <text x="${sealLeftX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">3rd</text> {/* Rank Text inside Left Seal */}
                    <circle cx="${sealRightX}" cy="${sealY}" r="${sealRadius}" fill="#996b4f"/> {/* Right Seal */}
                    <text x="${sealRightX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">3rd</text> {/* Rank Text inside Right Seal */}
                    <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Certificate of Achievement</text>
                    <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                    <text x="50%" y="300" class="name-font" font-size="72" fill="#996b4f" text-anchor="middle">{{Agent Name}}</text>
                    <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For achieving</text>
                    <text x="50%" y="460" class="title-font" font-size="56" fill="#996b4f" text-anchor="middle">3rd Place</text>
                    <text x="50%" y="530" class="body-font" font-size="24" fill="#555" text-anchor="middle">in the {{Pod Name}} KPI Competition</text>
                    <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                    <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                 </svg>`;
            const svgTemplateTeam = `
                 <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                    ${svgDefs}
                    <rect x="0" y="0" width="100%" height="100%" fill="#e0f2f7"/>
                    <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="#625fc3" stroke-width="15"/> {/* Team color border */}
                    <circle cx="${sealLeftX}" cy="${sealY}" r="${sealRadius}" fill="#625fc3"/> {/* Left Seal */}
                     <text x="${sealLeftX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">1st</text> {/* Rank Text */}
                    <circle cx="${sealRightX}" cy="${sealY}" r="${sealRadius}" fill="#625fc3"/> {/* Right Seal */}
                    <text x="${sealRightX}" y="${sealY}" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">1st</text> {/* Rank Text */}
                    <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Winning Team Award</text>
                    <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">Presented to</text>
                    <text x="50%" y="300" class="name-font" font-size="72" fill="#625fc3" text-anchor="middle">{{Team Name}}</text>
                    <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For winning the {{Pod Name}} KPI Competition</text>
                    <text x="50%" y="480" class="body-font" font-size="20" fill="#555" text-anchor="middle">Team Members: {{Members}}</text>
                    <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                    <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                 </svg>`;


            // --- Replace Placeholders ---
            const generated: CertificateData[] = [];
            const endDateObj = competition.endDate instanceof Timestamp ? competition.endDate.toDate() : competition.endDate;
            const dateStr = format(endDateObj, 'd MMMM yyyy'); // Use 'd MMMM yyyy' format

             const replacePlaceholders = (template: string, data: Record<string, string>): string => {
                 let result = template;
                 for (const key in data) {
                    // Added fallback for potentially missing values
                    result = result.replace(new RegExp(`{{${key}}}`, 'gi'), data[key] || 'N/A');
                 }
                 return result;
             };

             // Group agents by rank
             const agentsByRank: { [rank: number]: AppUser[] } = {};
             rankedAgents.forEach(agent => {
                 if (!agentsByRank[agent.rank]) {
                     agentsByRank[agent.rank] = [];
                 }
                 agentsByRank[agent.rank].push(agent);
             });

             // Generate certificates for top 3 ranks (handling ties)
             for (let rank = 1; rank <= 3; rank++) {
                 const agentsAtRank = agentsByRank[rank];
                 if (!agentsAtRank || agentsAtRank.length === 0) continue; // Skip if no one achieved this rank

                 const agentNames = formatNames(agentsAtRank.map(a => a.name));
                 const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd';
                 const templateData = {
                     'Agent Name': agentNames,
                     'Pod Name': pod.name,
                     'Team Manager Name': podManager?.name || 'N/A',
                     'Date': dateStr,
                 };

                 let svgTemplate = '';
                 if (rank === 1) svgTemplate = svgTemplateFirst;
                 else if (rank === 2) svgTemplate = svgTemplateSecond;
                 else if (rank === 3) svgTemplate = svgTemplateThird;

                 if (svgTemplate) { // Only generate if a template exists for the rank
                    generated.push({
                        svgContent: replacePlaceholders(svgTemplate, templateData),
                        filename: `${pod.name}_Agent_Rank_${rank}.jpg`, // Adjust filename for clarity
                        title: `${agentNames} - ${rank}${rankSuffix} Place`
                    });
                 }
             }

            // Generate for Winning Team(s) - Handling ties (Only Rank 1)
             const winningTeams = rankedTeams.filter(team => team.rank === 1);
             if (winningTeams.length > 0) {
                const winningTeamNames = formatNames(winningTeams.map(t => t.name));

                // Aggregate members from all winning teams (unique)
                const allWinningAgentIds = new Set<string>();
                winningTeams.forEach(team => (team.agentIds || []).forEach(id => allWinningAgentIds.add(id)));

                const memberNames = Array.from(allWinningAgentIds)
                    .map(id => podAgentUsers.find(u => u.id === id)?.name)
                    .filter((name): name is string => !!name);
                const membersStr = formatNames(memberNames);

                const teamTemplateData = {
                    'Team Name': winningTeamNames, // Show all tied team names
                    'Pod Name': pod.name,
                    'Team Manager Name': podManager?.name || 'N/A',
                    'Date': dateStr,
                    'Members': membersStr,
                };
                generated.push({
                    svgContent: replacePlaceholders(svgTemplateTeam, teamTemplateData),
                    filename: `${pod.name}_WinningTeam${winningTeams.length > 1 ? 's' : ''}.jpg`,
                    title: `Winning Team(s) - ${winningTeamNames}`
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

    // --- Helper to Download SVG as JPG ---
    const downloadSvgAsJpg = (svgContent: string, filename: string) => {
        console.log("[downloadSvgAsJpg] Starting conversion for:", filename);
        console.log("[downloadSvgAsJpg] SVG Content Length:", svgContent.length);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
             console.error("[downloadSvgAsJpg] Could not create canvas context.");
             toast({ variant: "destructive", title: "Error", description: "Could not create canvas context." });
            return;
        }

        const img = new Image();

        // Convert SVG string to base64 data URL using btoa
        let dataUrl;
        try {
            // Ensure SVG has XML namespace
            const svgWithXmlns = svgContent.includes('xmlns=') ? svgContent : svgContent.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
            const base64Svg = btoa(unescape(encodeURIComponent(svgWithXmlns)));
            dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
            console.log("[downloadSvgAsJpg] Generated Base64 Data URL (length):", dataUrl.length);
            // console.log("[downloadSvgAsJpg] Data URL (first 100 chars):", dataUrl.substring(0, 100)); // Log start of URL
        } catch (e: any) {
            console.error("[downloadSvgAsJpg] Error creating Base64 Data URL:", e);
            toast({ variant: "destructive", title: "SVG Encoding Error", description: `Failed to encode SVG: ${e.message}` });
            return;
        }


        img.onload = () => {
            console.log("[downloadSvgAsJpg] SVG Image loaded successfully into Image object.");
            // Set canvas dimensions based on SVG size
            canvas.width = SVG_WIDTH;
            canvas.height = SVG_HEIGHT;
            console.log(`[downloadSvgAsJpg] Canvas dimensions set to: ${canvas.width}x${canvas.height}`);

             // Fill canvas with white background before drawing SVG
             ctx.fillStyle = '#ffffff'; // White background
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             console.log("[downloadSvgAsJpg] Canvas background filled white.");

            // Draw the SVG image onto the canvas
            try {
                 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                 console.log("[downloadSvgAsJpg] SVG drawn onto canvas successfully.");

                 // Convert canvas to JPG data URL
                 const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9); // High quality JPG
                 console.log("[downloadSvgAsJpg] Canvas converted to JPG data URL (length):", jpgDataUrl.length);

                 // Trigger download
                 const a = document.createElement('a');
                 a.href = jpgDataUrl;
                 a.download = filename; // Filename should end with .jpg
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 console.log("[downloadSvgAsJpg] Download triggered for:", filename);

            } catch (drawError: any) {
                 console.error("[downloadSvgAsJpg] Error drawing SVG onto canvas:", drawError);
                 toast({ variant: "destructive", title: "Drawing Error", description: `Could not draw certificate image: ${drawError.message}` });
            } finally {
                 // Clean up if using Object URLs (not needed with btoa approach)
                 // if (url.startsWith('blob:')) {
                 //     URL.revokeObjectURL(url);
                 //     console.log("Blob URL revoked");
                 // }
            }
        };

        img.onerror = (errorEvent) => {
            // More detailed error logging
            console.error("[downloadSvgAsJpg] Error loading SVG into Image object:", errorEvent);
            let errorDescription = "Could not load certificate image for conversion.";
            if (typeof errorEvent === 'string') {
                errorDescription += ` Details: ${errorEvent}`;
            } else if (errorEvent instanceof Event) {
                errorDescription += ` Event type: ${errorEvent.type}`;
            }
             // Attempt to load the Data URL in a new tab for debugging
             console.log("[downloadSvgAsJpg] Attempting to open SVG Data URL in new tab for debugging...");
             window.open(dataUrl, '_blank');

            toast({ variant: "destructive", title: "SVG Load Error", description: errorDescription });
        };

        console.log("[downloadSvgAsJpg] Setting Image src to data URL...");
        img.src = dataUrl;
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
                                <Skeleton className="h-[300px] w-full frosted-glass" />
                                <Skeleton className="h-[300px] w-full frosted-glass" />
                            </div>
                        </div>
                    )}

                    {/* Generated Certificates Display */}
                    {!isLoadingData && generatedCertificates.length > 0 && (
                        <div className="mt-6 space-y-4">
                            <h3 className="text-lg font-semibold">Generated Certificates</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {generatedCertificates.map((cert, index) => (
                                    <Card key={index} className="overflow-hidden shadow-md frosted-glass">
                                        <CardHeader className="p-3 bg-muted/50">
                                            <CardTitle className="text-sm">{cert.title}</CardTitle>
                                        </CardHeader>
                                        {/* Adjusted CardContent and container div for height limit */}
                                        <CardContent className="p-4 flex flex-col items-center gap-4 max-h-[400px]"> {/* Limit card content height */}
                                            {/* Container for the SVG preview with max height and flex centering */}
                                            <div
                                                className="certificate-svg-container border rounded-md overflow-hidden w-full max-h-[300px] flex items-center justify-center" // Added max-h and flex centering
                                            >
                                                {/* Render SVG wrapper with scaling styles */}
                                                <div
                                                    className="w-full h-full flex items-center justify-center" // Inner div also uses flex to center content
                                                    style={{ aspectRatio: `${SVG_WIDTH} / ${SVG_HEIGHT}` }} // Maintain aspect ratio
                                                    dangerouslySetInnerHTML={{ __html: cert.svgContent }}
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => downloadSvgAsJpg(cert.svgContent, cert.filename)} // Use new download function
                                                className="w-full mt-auto" // Push button to bottom
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download JPG {/* Changed button text */}
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
