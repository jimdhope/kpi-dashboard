'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // For filtering
import { Download, Filter } from 'lucide-react';

// TODO: Replace with actual achievement types and fetching logic for admin view
interface AdminAchievement {
  id: string;
  agentName: string;
  agentId: string;
  kpiName: string;
  value: number;
  date: string; // Or Date object
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected'; // Example status
}

export default function AdminAchievementsPage() {
  // TODO: Fetch all achievements, potentially with filters
  const allAchievements: AdminAchievement[] = [
    { id: 'a1', agentName: 'Charlie Brown', agentId: 'user-charlie-456', kpiName: 'Sales', value: 50000, date: '2024-07-28', status: 'Approved' },
    { id: 'a2', agentName: 'Charlie Brown', agentId: 'user-charlie-456', kpiName: 'Customer Acquisition', value: 10, date: '2024-07-27', notes: 'Demo day leads', status: 'Approved' },
    { id: 'a3', agentName: 'Alice Johnson', agentId: 'user-alice-123', kpiName: 'Sales', value: 65000, date: '2024-07-28', status: 'Pending' },
    { id: 'a4', agentName: 'Bob Williams', agentId: 'user-bob-789', kpiName: 'Customer Acquisition', value: 12, date: '2024-07-28', status: 'Approved' },
     { id: 'a5', agentName: 'Alice Johnson', agentId: 'user-alice-123', kpiName: 'Sales', value: 15000, date: '2024-07-29', status: 'Rejected', notes: "Duplicate entry" },
  ];

  // TODO: Implement filtering and approval/rejection logic

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Achievements</CardTitle>
          <CardDescription>Review, approve, or reject achievements logged by agents.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtering Options */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
             <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="agent-filter">Agent</label>
                <Select>
                  <SelectTrigger id="agent-filter" className="w-[180px]">
                    <SelectValue placeholder="Filter by Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {/* TODO: Populate dynamically */}
                    <SelectItem value="user-charlie-456">Charlie Brown</SelectItem>
                    <SelectItem value="user-alice-123">Alice Johnson</SelectItem>
                     <SelectItem value="user-bob-789">Bob Williams</SelectItem>
                  </SelectContent>
                </Select>
            </div>
             <div className="grid gap-2">
                 <label className="text-sm font-medium" htmlFor="kpi-filter">KPI</label>
                <Select>
                  <SelectTrigger id="kpi-filter" className="w-[180px]">
                    <SelectValue placeholder="Filter by KPI" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">All KPIs</SelectItem>
                      {/* TODO: Populate dynamically */}
                     <SelectItem value="Sales">Sales</SelectItem>
                     <SelectItem value="Customer Acquisition">Customer Acquisition</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
               <label className="text-sm font-medium" htmlFor="status-filter">Status</label>
                 <Select>
                  <SelectTrigger id="status-filter" className="w-[150px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
            </div>
             <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" /> Apply Filters
             </Button>
             <Button variant="outline" className="ml-auto">
                <Download className="mr-2 h-4 w-4" /> Export Data
             </Button>
          </div>

          {/* Achievements Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>KPI</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAchievements.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No achievements found matching the criteria.
                    </TableCell>
                  </TableRow>
              ) : (
                allAchievements.map((ach) => (
                  <TableRow key={ach.id}>
                    <TableCell>{ach.agentName}</TableCell>
                    <TableCell>{ach.kpiName}</TableCell>
                    <TableCell>{ach.value.toLocaleString()}</TableCell>
                    <TableCell>{ach.date}</TableCell>
                    <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ach.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            ach.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                            {ach.status}
                        </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{ach.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      {ach.status === 'Pending' && (
                        <div className="flex gap-1 justify-end">
                          {/* TODO: Add onClick handlers */}
                          <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/50">Approve</Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50">Reject</Button>
                        </div>
                      )}
                       {ach.status !== 'Pending' && (
                           <Button variant="ghost" size="sm" disabled>Reviewed</Button> // Indicate reviewed
                       )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
           {/* TODO: Add pagination controls */}
        </CardContent>
      </Card>
    </div>
  );
}
