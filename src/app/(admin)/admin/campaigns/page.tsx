'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle } from 'lucide-react';
import Link from 'next/link'; // Import Link

// TODO: Replace with actual campaign type and fetching logic
interface Campaign {
  id: string;
  name: string;
  logoUrl: string; // URL for the campaign logo
}

export default function AdminCampaignsPage() {
  // TODO: Fetch campaigns from a service or API
  const campaigns: Campaign[] = [
    { id: 'camp-1', name: 'Q3 Sales Drive', logoUrl: 'https://picsum.photos/seed/q3sales/40' },
    { id: 'camp-2', name: 'New Product Launch', logoUrl: 'https://picsum.photos/seed/productlaunch/40' },
    { id: 'camp-3', name: 'Summer Fest Challenge', logoUrl: 'https://picsum.photos/seed/summerfest/40' },
    { id: 'camp-4', name: 'End of Year Push', logoUrl: 'https://picsum.photos/seed/eoypush/40' },
  ];

  // TODO: Implement edit and delete handlers
  const handleEdit = (campaignId: string) => {
    console.log('Edit campaign:', campaignId);
    // Navigate to edit page or open modal
  };

  const handleDelete = (campaignId: string) => {
    console.log('Delete campaign:', campaignId);
    // Show confirmation dialog, then call delete service/API
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
           <div>
            <CardTitle>Manage Campaigns</CardTitle>
            <CardDescription>View, edit, or delete existing campaigns.</CardDescription>
          </div>
           {/* TODO: Link to a page/modal for adding a new campaign */}
          <Button asChild>
            <Link href="#"> {/* Replace # with the actual add campaign route */}
                <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No campaigns found. Create one to get started!
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={campaign.logoUrl} alt={`${campaign.name} logo`} data-ai-hint="campaign logo" />
                        <AvatarFallback>{campaign.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(campaign.id)}
                          aria-label={`Edit ${campaign.name}`}
                          title={`Edit ${campaign.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => handleDelete(campaign.id)}
                          aria-label={`Delete ${campaign.name}`}
                           title={`Delete ${campaign.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* TODO: Add pagination controls if necessary */}
        </CardContent>
      </Card>
    </div>
  );
}
