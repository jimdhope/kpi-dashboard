
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Home, Users, Trophy, BarChart, CheckSquare, ClipboardList, Target, Megaphone, ShieldCheck, UsersRound, Award, PlusCircle, Edit, ListChecks, UserPlus, Shuffle, MessageSquare, Filter, CalendarIcon, User } from 'lucide-react'; // Added User icon
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// --- Mock UI Components for Admin Guide ---

const MockFilterCard = () => (
  <Card className="frosted-glass">
    <CardHeader>
      <CardTitle className="text-base font-medium flex items-center gap-2"><Filter className="h-4 w-4"/> Filters</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-wrap gap-4 items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="mock-timeframe">Period</Label>
        <Input id="mock-timeframe" defaultValue="Weekly" className="w-[150px] h-9 bg-background/50" disabled/>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mock-start-date">Start Date</Label>
        <Button variant="outline" className="w-[180px] h-9 justify-start text-left font-normal bg-background/50" disabled>
          <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
          May 5th, 2025
        </Button>
      </div>
    </CardContent>
  </Card>
);

const MockAchievementSummaryCard = () => (
  <Card className="frosted-glass">
    <CardHeader className="pb-2 pt-3 px-3">
      <CardTitle className="text-sm font-medium truncate">📞 Sales Calls</CardTitle>
    </CardHeader>
    <CardContent className="px-3 pb-3">
      <div className="text-xl font-bold text-primary">1,250</div>
      <CardDescription className="text-xs">Total Count</CardDescription>
    </CardContent>
  </Card>
);

const MockCampaignListSnippet = () => (
  <Card className="frosted-glass">
    <CardHeader className="flex flex-row items-center justify-between p-3">
      <CardTitle className="text-sm">Manage Campaigns</CardTitle>
      <Button size="xs" disabled><PlusCircle className="mr-1 h-3 w-3"/>Add</Button>
    </CardHeader>
    <CardContent className="p-3 text-xs">
      <div className="flex items-center justify-between py-1 border-b">
        <span>Q1 Sales Drive</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled><ListChecks className="h-3 w-3"/></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled><Edit className="h-3 w-3"/></Button>
        </div>
      </div>
      <div className="flex items-center justify-between py-1">
        <span>Summer Sprint</span>
        <div className="flex gap-1">
           <Button variant="ghost" size="icon" className="h-6 w-6" disabled><ListChecks className="h-3 w-3"/></Button>
           <Button variant="ghost" size="icon" className="h-6 w-6" disabled><Edit className="h-3 w-3"/></Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const MockPodListSnippet = () => (
 <Card className="frosted-glass">
    <CardHeader className="flex flex-row items-center justify-between p-3">
      <CardTitle className="text-sm">Manage Pods</CardTitle>
      <Button size="xs" disabled><PlusCircle className="mr-1 h-3 w-3"/>Add</Button>
    </CardHeader>
    <CardContent className="p-3 text-xs">
      <div className="flex items-center justify-between py-1 border-b">
        <span>Alpha Pod</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled><UserPlus className="h-3 w-3"/></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled><Edit className="h-3 w-3"/></Button>
        </div>
      </div>
      <div className="flex items-center justify-between py-1">
        <span>Bravo Pod</span>
        <div className="flex gap-1">
           <Button variant="ghost" size="icon" className="h-6 w-6" disabled><UserPlus className="h-3 w-3"/></Button>
           <Button variant="ghost" size="icon" className="h-6 w-6" disabled><Edit className="h-3 w-3"/></Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const MockCompetitionFormSnippet = () => (
  <Card className="frosted-glass p-3">
    <CardTitle className="text-sm mb-2">New Competition</CardTitle>
    <div className="space-y-2">
      <div><Label className="text-xs">Name</Label><Input defaultValue="Weekly Challenge" className="h-7 text-xs bg-background/50" disabled/></div>
      <div><Label className="text-xs">Campaign</Label><Input defaultValue="Q1 Sales Drive" className="h-7 text-xs bg-background/50" disabled/></div>
      <div><Label className="text-xs">Start Date</Label><Input defaultValue="05/12/2025" className="h-7 text-xs bg-background/50" disabled/></div>
    </div>
  </Card>
);

const MockTeamManagementSnippet = () => (
  <Card className="frosted-glass p-3">
    <CardTitle className="text-sm mb-2">Team Setup: Alpha Pod</CardTitle>
    <div className="grid grid-cols-3 gap-2 text-xs">
      <Card className="bg-card/50 p-2"><CardTitle className="text-xs mb-1">Team Eagles</CardTitle>Agent 1, Agent 2</Card>
      <Card className="bg-card/50 p-2"><CardTitle className="text-xs mb-1">Team Lions</CardTitle>Agent 3, Agent 4</Card>
      <Card className="bg-card/50 p-2"><CardTitle className="text-xs mb-1">Unassigned</CardTitle>Agent 5</Card>
    </div>
    <Button size="xs" variant="outline" className="mt-2 h-7" disabled><Shuffle className="mr-1 h-3 w-3"/>Random Assign</Button>
  </Card>
);

const MockLogAchievementsAdminSnippet = () => (
  <Card className="frosted-glass p-3">
    <CardTitle className="text-sm mb-2">Log Achievements: Alpha Pod - 05/12/2025</CardTitle>
    <Table className="text-xs">
      <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>📞 Calls</TableHead><TableHead>🤝 Deals</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow><TableCell>Agent 1</TableCell><TableCell><Input type="number" defaultValue="5" className="h-6 w-12 text-xs p-1 bg-background/50" disabled/></TableCell><TableCell><Input type="number" defaultValue="1" className="h-6 w-12 text-xs p-1 bg-background/50" disabled/></TableCell></TableRow>
        <TableRow><TableCell>Agent 2</TableCell><TableCell><Input type="number" defaultValue="7" className="h-6 w-12 text-xs p-1 bg-background/50" disabled/></TableCell><TableCell><Input type="number" defaultValue="0" className="h-6 w-12 text-xs p-1 bg-background/50" disabled/></TableCell></TableRow>
      </TableBody>
    </Table>
  </Card>
);

const MockMessageOfTheDayAdminSnippet = () => (
  <Card className="frosted-glass p-3">
    <CardTitle className="text-sm mb-2">Message of the Day</CardTitle>
    <div className="flex items-center gap-2 mb-2">
      <Button variant="outline" size="sm" className="text-lg p-1 h-7 w-7" disabled>🎉</Button>
      <Input defaultValue="Great work this week!" className="h-7 text-xs flex-grow bg-background/50" disabled/>
    </div>
    <div className="h-16 border rounded bg-background/30 p-1 text-xs text-muted-foreground italic">Rich text editor area...</div>
    <div className="flex justify-between items-center mt-2">
        <div className="flex items-center space-x-2">
            <Checkbox id="mock-motd-enable" checked disabled/>
            <Label htmlFor="mock-motd-enable" className="text-xs">Enable</Label>
        </div>
        <Button size="xs" className="h-7" disabled>Save</Button>
    </div>
  </Card>
);


export default function AdminGuidePage() {
  const sections = [
    { id: "dashboard", title: "Admin Dashboard Overview", icon: <Home/>, description: "Get a quick overview of performance.", mockUi: <MockFilterCard/> },
    { id: "campaigns", title: "Managing Campaigns", icon: <Megaphone/>, description: "Set up and define rules for your overarching campaigns.", mockUi: <MockCampaignListSnippet/> },
    { id: "pods", title: "Managing Pods", icon: <ShieldCheck/>, description: "Organize users into pods, assign managers, and link to campaigns.", mockUi: <MockPodListSnippet/> },
    { id: "users", title: "Managing Users", icon: <UsersRound/>, description: "Add, edit, and assign roles to all users in the system.", mockUi: <Card className="frosted-glass p-3"><CardTitle className="text-sm">User List Snippet...</CardTitle></Card> },
    { id: "competitions", title: "Setting Up Competitions", icon: <Trophy/>, description: "Create weekly or custom competitions, link them to campaigns and pods, and define specific rules.", mockUi: <MockCompetitionFormSnippet/> },
    { id: "teams", title: "Managing Teams", icon: <Users/>, description: "For each competition and pod, create teams and assign agents.", mockUi: <MockTeamManagementSnippet/> },
    { id: "log-achievements", title: "Logging Achievements (Admin)", icon: <CheckSquare/>, description: "Manually log or adjust achievements for any agent in a selected pod.", mockUi: <MockLogAchievementsAdminSnippet/> },
    { id: "daily-scores", title: "Daily Scores & Teams Updates", icon: <ClipboardList/>, description: "View daily performance for pods and send updates to Microsoft Teams.", mockUi: <Card className="frosted-glass p-3"><CardTitle className="text-sm">Daily Scores Snippet...</CardTitle></Card> },
    { id: "pod-targets", title: "Pod Daily Targets", icon: <Target/>, description: "Set specific daily targets for each rule within a pod for a competition.", mockUi: <Card className="frosted-glass p-3"><CardTitle className="text-sm">Pod Targets Snippet...</CardTitle></Card> },
    { id: "certificates", title: "Generating Certificates", icon: <Award/>, description: "Create and download certificates for top-performing agents and teams.", mockUi: <Card className="frosted-glass p-3"><CardTitle className="text-sm">Certificates Snippet...</CardTitle></Card> },
    { id: "message-of-day", title: "Message of the Day", icon: <MessageSquare/>, description: "Set a daily message to motivate and inform your agents.", mockUi: <MockMessageOfTheDayAdminSnippet/> },
    { id: "profile", title: "Profile Management", icon: <User/>, description: "Update your own administrator profile details.", mockUi: <Card className="frosted-glass p-3"><CardTitle className="text-sm">Profile Snippet...</CardTitle></Card> },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-28 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary drop-shadow-lg">
            Admin & Manager Guide
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Everything you need to know to manage KPI Quest effectively.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-16 lg:py-20 frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-2xl font-semibold sticky top-24">Navigation</h2>
              <nav className="sticky top-32">
                <ul className="space-y-2">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                        {React.cloneElement(section.icon, { className: "h-4 w-4"})}
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className="lg:col-span-2 space-y-16">
              {sections.map((section) => (
                <div key={section.id} id={section.id} className="pt-8 md:pt-12 scroll-mt-20">
                  <h3 className="text-2xl md:text-3xl font-semibold flex items-center gap-3 mb-4">
                     {React.cloneElement(section.icon, { className: "h-7 w-7 text-primary"})}
                     {section.title}
                  </h3>
                  <p className="text-muted-foreground mb-6 text-base md:text-lg">{section.description}</p>
                  <div className="p-4 border rounded-lg bg-background/30 shadow-inner">
                    {section.mockUi}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-16 md:py-24 text-center frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Lead Your Team to Success?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Utilize these tools to drive engagement and achieve your goals.
          </p>
           <Link href="/admin" passHref>
             <Button size="lg" variant="default">
               Go to Admin Dashboard
             </Button>
            </Link>
        </div>
      </section>
    </div>
  );
}
    

    