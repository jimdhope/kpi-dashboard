
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Download, AlertCircle, Filter } from 'lucide-react'; // Added Filter
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

// Define A4 Landscape Dimensions in pixels (approx 96 DPI)
const SVG_WIDTH = 1123;
const SVG_HEIGHT = 794;


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

         const sortedItems = [...items].sort((a, b) => b.score - a.score);
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


             // --- SVG Templates (Use Google Font & Metallic Gradients) ---
             // Font Imports for SVG - embedding using <style>
             const svgDefs = `
                 <defs>
                    <style type="text/css">
                        @font-face {
                          font-family: 'Inter';
                          font-style: normal;
                          font-weight: 400;
                          src: url(data:font/woff2;base64,PLACEHOLDER_INTER_REGULAR_WOFF2_BASE64_DATA_HERE) format('woff2');
                          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
                        }
                        @font-face {
                          font-family: 'Inter';
                          font-style: normal;
                          font-weight: 700;
                          src: url(data:font/woff2;base64,PLACEHOLDER_INTER_BOLD_WOFF2_BASE64_DATA_HERE) format('woff2');
                          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
                        }
                        @font-face {
                          font-family: 'Dancing Script';
                          font-style: normal;
                          font-weight: 700;
                          src: url(data:font/woff2;base64,PLACEHOLDER_DANCING_SCRIPT_BOLD_WOFF2_BASE64_DATA_HERE) format('woff2');
                          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
                        }
                        /* Font families */
                        .body-font { font-family: 'Inter', Arial, Helvetica, sans-serif; }
                        .title-font { font-family: 'Inter', Arial, Helvetica, sans-serif; font-weight: 700; }
                        .name-font { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-weight: 700; }
                        .signature-font { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 64px; font-weight: 700; }
                    </style>
                    {/* Metallic Gradients */}
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#f8e8a1;stop-opacity:1" /> {/* Light gold */}
                      <stop offset="50%" style="stop-color:#cfae50;stop-opacity:1" /> {/* Mid gold */}
                      <stop offset="100%" style="stop-color:#b5933a;stop-opacity:1" /> {/* Dark gold */}
                    </linearGradient>
                    <linearGradient id="silverGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" /> {/* White */}
                      <stop offset="50%" style="stop-color:#c0c0c0;stop-opacity:1" /> {/* Silver */}
                      <stop offset="100%" style="stop-color:#a9a9a9;stop-opacity:1" /> {/* Darker grey */}
                    </linearGradient>
                    <linearGradient id="bronzeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#d8a987;stop-opacity:1" /> {/* Light bronze */}
                      <stop offset="50%" style="stop-color:#a07658;stop-opacity:1" /> {/* Mid bronze */}
                      <stop offset="100%" style="stop-color:#8c5d3c;stop-opacity:1" /> {/* Dark bronze */}
                    </linearGradient>
                     <linearGradient id="teamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#a09ef0;stop-opacity:1" /> {/* Light purple */}
                      <stop offset="50%" style="stop-color:#625fc3;stop-opacity:1" /> {/* Base purple */}
                      <stop offset="100%" style="stop-color:#4b47a3;stop-opacity:1" /> {/* Darker purple */}
                    </linearGradient>
                </defs>
             `;

             // Rosette positioning and styling
             const sealY = SVG_HEIGHT / 2; // Vertically center the seals
             const sealLeftX = 120; // X position for left seal
             const sealRightX = SVG_WIDTH - 120; // X position for right seal
             const rankTextFontSize = 32;
             const rosettePathData = "M 0 -60 L 13 -50 L 30 -52 L 26 -35 L 52 -30 L 35 -26 L 50 -13 L 30 0 L 50 13 L 35 26 L 52 30 L 26 35 L 30 52 L 13 50 L 0 60 L -13 50 L -30 52 L -26 35 L -52 -30 L -35 -26 L -50 -13 L -30 0 L -50 -13 L -35 -26 L -52 -30 L -26 -35 L -30 -52 L -13 -50 Z";

             // Updated Templates applying gradients
             const svgTemplateFirst = `
                <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                  ${svgDefs}
                  <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0"/>
                  <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="url(#goldGradient)" stroke-width="15"/> {/* Gold border */}
                  {/* Left Rosette Seal */}
                  <g transform="translate(${sealLeftX}, ${sealY})">
                    <path d="${rosettePathData}" fill="url(#goldGradient)"/>
                    <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#443000" text-anchor="middle" dominant-baseline="central">1st</text> {/* Darker text for gold */}
                  </g>
                  {/* Right Rosette Seal */}
                  <g transform="translate(${sealRightX}, ${sealY})">
                     <path d="${rosettePathData}" fill="url(#goldGradient)"/>
                     <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#443000" text-anchor="middle" dominant-baseline="central">1st</text>
                  </g>
                  {/* Rest of the certificate content */}
                  <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Certificate of Achievement</text>
                  <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="50%" y="300" class="name-font" font-size="72" fill="#8a6d3b" text-anchor="middle">{{Agent Name}}</text> {/* Slightly darker gold text */}
                  <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="50%" y="460" class="title-font" font-size="56" fill="#8a6d3b" text-anchor="middle">1st Place</text>
                  <text x="50%" y="530" class="body-font" font-size="24" fill="#555" text-anchor="middle">in the {{Pod Name}} KPI Competition</text>
                  <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                  <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                </svg>`;
             const svgTemplateSecond = `
                <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                  ${svgDefs}
                  <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0"/>
                  <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="url(#silverGradient)" stroke-width="15"/> {/* Silver border */}
                  {/* Left Rosette Seal */}
                  <g transform="translate(${sealLeftX}, ${sealY})">
                    <path d="${rosettePathData}" fill="url(#silverGradient)"/>
                    <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#333" text-anchor="middle" dominant-baseline="central">2nd</text> {/* Dark text for silver */}
                  </g>
                  {/* Right Rosette Seal */}
                   <g transform="translate(${sealRightX}, ${sealY})">
                     <path d="${rosettePathData}" fill="url(#silverGradient)"/>
                     <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#333" text-anchor="middle" dominant-baseline="central">2nd</text>
                  </g>
                   {/* Rest of the certificate content */}
                  <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Certificate of Achievement</text>
                  <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                  <text x="50%" y="300" class="name-font" font-size="72" fill="#666" text-anchor="middle">{{Agent Name}}</text> {/* Mid grey text */}
                  <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For achieving</text>
                  <text x="50%" y="460" class="title-font" font-size="56" fill="#666" text-anchor="middle">2nd Place</text>
                  <text x="50%" y="530" class="body-font" font-size="24" fill="#555" text-anchor="middle">in the {{Pod Name}} KPI Competition</text>
                  <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                  <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                </svg>`;
            const svgTemplateThird = `
                 <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                    ${svgDefs}
                    <rect x="0" y="0" width="100%" height="100%" fill="#f0f0f0"/>
                    <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="url(#bronzeGradient)" stroke-width="15"/> {/* Bronze border */}
                    {/* Left Rosette Seal */}
                    <g transform="translate(${sealLeftX}, ${sealY})">
                       <path d="${rosettePathData}" fill="url(#bronzeGradient)"/>
                       <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">3rd</text> {/* White text for bronze */}
                    </g>
                    {/* Right Rosette Seal */}
                    <g transform="translate(${sealRightX}, ${sealY})">
                       <path d="${rosettePathData}" fill="url(#bronzeGradient)"/>
                       <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">3rd</text>
                    </g>
                     {/* Rest of the certificate content */}
                    <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Certificate of Achievement</text>
                    <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">This certificate is awarded to</text>
                    <text x="50%" y="300" class="name-font" font-size="72" fill="#8c5d3c" text-anchor="middle">{{Agent Name}}</text> {/* Darker bronze text */}
                    <text x="50%" y="380" class="body-font" font-size="28" fill="#555" text-anchor="middle">For achieving</text>
                    <text x="50%" y="460" class="title-font" font-size="56" fill="#8c5d3c" text-anchor="middle">3rd Place</text>
                    <text x="50%" y="530" class="body-font" font-size="24" fill="#555" text-anchor="middle">in the {{Pod Name}} KPI Competition</text>
                    <text x="25%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Date}}</text>
                    <text x="75%" y="${SVG_HEIGHT - 120}" class="signature-font" fill="#555" text-anchor="middle">{{Team Manager Name}}</text>
                 </svg>`;
            const svgTemplateTeam = `
                 <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                    ${svgDefs}
                    <rect x="0" y="0" width="100%" height="100%" fill="#e0f2f7"/>
                    <rect x="20" y="20" width="${SVG_WIDTH - 40}" height="${SVG_HEIGHT - 40}" fill="none" stroke="url(#teamGradient)" stroke-width="15"/> {/* Team color border */}
                    {/* Left Rosette Seal */}
                    <g transform="translate(${sealLeftX}, ${sealY})">
                       <path d="${rosettePathData}" fill="url(#teamGradient)"/>
                       <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">1st</text>
                    </g>
                    {/* Right Rosette Seal */}
                    <g transform="translate(${sealRightX}, ${sealY})">
                       <path d="${rosettePathData}" fill="url(#teamGradient)"/>
                       <text x="0" y="0" class="title-font" font-size="${rankTextFontSize}" fill="#fff" text-anchor="middle" dominant-baseline="central">1st</text>
                    </g>
                     {/* Rest of the certificate content */}
                    <text x="50%" y="120" class="title-font" font-size="48" fill="#333" text-anchor="middle">Winning Team Award</text>
                    <text x="50%" y="190" class="body-font" font-size="28" fill="#555" text-anchor="middle">Presented to</text>
                    <text x="50%" y="300" class="name-font" font-size="72" fill="#4b47a3" text-anchor="middle">{{Team Name}}</text> {/* Darker purple text */}
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
                    const placeholder = `{{${key}}}`; // Correctly construct placeholder string
                    const value = String(data[key] || 'N/A'); // Ensure value is string

                    // XML-escape the value
                    const escapedValue = value
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&apos;');
                    
                    // Create a RegExp to find all occurrences of the placeholder.
                    // Escape the curly braces and any special characters in the key itself if necessary.
                    // For simple keys like "Agent Name", direct construction is usually fine,
                    // but escaping the key for RegExp is safer.
                    const escapedKeyForRegex = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\{\\{${escapedKeyForRegex}\\}\\}`, 'g'); // Use 'g' for global replacement
                    
                    result = result.replace(regex, escapedValue);
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
                        filename: `${pod.name}_Agent_Rank_${rank}.svg`, // Adjust filename for clarity, save as SVG
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
                    filename: `${pod.name}_WinningTeam${winningTeams.length > 1 ? 's' : ''}.svg`, // Save as SVG
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

    // Client-side download function for SVGs
    const downloadCertificateAsSvg = (svgContent: string, filename: string) => {
        console.log("[Download] Starting SVG download for:", filename);
        try {
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename; // Filename should end with .svg
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            console.log("[Download] Download triggered for:", filename);
        } catch (error: any) {
            console.error("[Download] Error in downloadCertificateAsSvg:", error);
            toast({ variant: "destructive", title: "Download Failed", description: error.message || "Could not download certificate." });
        }
    };


    return (
        <div className="space-y-6">
             {/* Filters Card */}
            <Card className="frosted-glass">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Generate Certificates</CardTitle>
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
                </CardContent>
            </Card>


             {isLoadingData && ( // Show skeleton loader for certificate results
                <div className="mt-6 space-y-4">
                    <Skeleton className="h-8 w-1/3" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Skeleton className="h-[300px] w-full frosted-glass" />
                        <Skeleton className="h-[300px] w-full frosted-glass" />
                    </div>
                </div>
            )}

            {/* Generated Certificates Display - Moved outside the filters card */}
            {!isLoadingData && generatedCertificates.length > 0 && (
                <div className="mt-6 space-y-4">
                    <h3 className="text-xl font-semibold">Generated Certificates</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {generatedCertificates.map((cert, index) => (
                            <Card key={index} className="overflow-hidden shadow-lg frosted-glass"> {/* Applied frosted-glass */}
                                <CardHeader className="p-3 bg-muted/50">
                                    <CardTitle className="text-base">{cert.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 flex flex-col items-center gap-4 max-h-[400px]">
                                    <div
                                        className="certificate-svg-container border rounded-md overflow-hidden w-full max-h-[300px] flex items-center justify-center bg-white" // Added bg-white for better SVG preview
                                    >
                                        <div
                                            className="w-full h-full flex items-center justify-center"
                                            style={{ aspectRatio: `${SVG_WIDTH} / ${SVG_HEIGHT}` }}
                                            dangerouslySetInnerHTML={{ __html: cert.svgContent }}
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadCertificateAsSvg(cert.svgContent, cert.filename)}
                                        className="w-full mt-auto"
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
        </div>
    );
}

