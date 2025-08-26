
'use client';

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Upload, AlertCircle, FileJson, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DataManagementPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    toast({ title: "Starting Export...", description: "Preparing your data for download." });

    try {
      const response = await fetch('/api/data/export');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export data.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `kpi-quest-backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Your data has been downloaded successfully.",
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "An unknown error occurred during export.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json') {
        setFileToImport(file);
        setFileName(file.name);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please select a valid JSON file.",
        });
        setFileToImport(null);
        setFileName('');
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleImport = async () => {
    setIsAlertOpen(false);
    if (!fileToImport) {
      toast({ variant: "destructive", title: "No File Selected", description: "Please select a file to import." });
      return;
    }

    setIsImporting(true);
    toast({ title: "Starting Import...", description: "This may take a few moments. Do not navigate away." });

    const reader = new FileReader();
    reader.readAsText(fileToImport);
    reader.onload = async (event) => {
        try {
            const fileContent = event.target?.result as string;
            // Basic validation to ensure it's a JSON object
            JSON.parse(fileContent);

             const response = await fetch('/api/data/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: fileContent,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to import data.');
            }

            toast({
                title: "Import Successful",
                description: `Successfully imported data. Processed ${result.totalRecords} records across ${result.collectionCount} collections.`,
                duration: 7000,
            });
             // Reset file input
             setFileToImport(null);
             setFileName('');
             if (fileInputRef.current) {
                 fileInputRef.current.value = "";
             }

        } catch (error: any) {
            console.error("Import error:", error);
            toast({
                variant: "destructive",
                title: "Import Failed",
                description: error.message || "An unknown error occurred during import.",
                duration: 10000,
            });
        } finally {
            setIsImporting(false);
        }
    };
     reader.onerror = () => {
        toast({ variant: "destructive", title: "File Read Error", description: "Could not read the selected file."});
        setIsImporting(false);
     };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>
            Download a full backup of all your application data as a single JSON file. This is useful for backups or migrating to another platform.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? 'Exporting...' : 'Export All Data'}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>
            Restore your application data from a previously exported JSON backup file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 text-destructive-foreground rounded-md border border-destructive/50">
                 <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="h-5 w-5" />
                    <span>WARNING: Destructive Action</span>
                 </div>
                 <p className="text-sm mt-2">
                    Importing data will <span className="font-bold">overwrite all existing data</span> in your database with the contents of the backup file. This action cannot be undone. It is strongly recommended to perform an export first.
                 </p>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="import-file">Select Backup File (.json)</Label>
                <Input
                    id="import-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    disabled={isImporting}
                    className="file:text-foreground"
                />
            </div>
             {fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded-md bg-muted">
                    <FileJson className="h-4 w-4"/>
                    <span>{fileName}</span>
                     <CheckCircle className="h-4 w-4 text-green-500 ml-auto"/>
                </div>
            )}
        </CardContent>
        <CardFooter>
           <Button onClick={() => setIsAlertOpen(true)} disabled={!fileToImport || isImporting}>
             {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
             {isImporting ? 'Importing...' : 'Import Data'}
           </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete all current data and replace it with the data from the file <span className="font-bold">"{fileName}"</span>. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} className="bg-destructive hover:bg-destructive/90">
              Yes, Overwrite and Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
