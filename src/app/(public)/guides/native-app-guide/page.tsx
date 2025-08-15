
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExternalLink, GanttChartSquare, Database, KeyRound, CheckCircle, Code } from 'lucide-react';
import Link from 'next/link';

// Mock UI Component for Code Snippet
const MockCodeSnippet = () => (
    <Card className="frosted-glass bg-background/50">
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2"><Code className="h-4 w-4"/> Example: Initializing Firebase</CardTitle>
      </CardHeader>
      <CardContent className="p-4 bg-black/80 rounded-b-lg">
        <pre className="text-xs text-white overflow-x-auto">
          <code>
{`// 1. Copy the config from src/lib/firebase-config.ts

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ...and so on
};

// 2. Initialize Firebase in your app's startup code
initializeApp(firebaseConfig);

// 3. Get a reference to Firestore
const db = getFirestore();

// 4. You can now read and write data (respecting security rules)
// Example: Fetching a pod document
const podRef = doc(db, "pods", "podId123");
const podSnap = await getDoc(podRef);

if (podSnap.exists()) {
  console.log("Pod data:", podSnap.data());
}
`}
          </code>
        </pre>
      </CardContent>
    </Card>
);

export default function NativeAppGuidePage() {
    const sections = [
        {
          id: "firebase-sdk",
          title: "The Firebase SDK Approach",
          icon: <GanttChartSquare />,
          description: "Instead of building a traditional backend API that you have to host and maintain, Firebase provides client-side Software Development Kits (SDKs). These SDKs allow your native desktop application to talk directly to the database (Firestore) in a secure way.",
        },
        {
          id: "how-it-works",
          title: "How It Works",
          icon: <Database />,
          description: "Your native app uses a special configuration object to connect to your specific Firebase project. Once initialized, you can use functions from the Firebase SDK (e.g., to get, add, or listen to data) right from your C#, Swift, or JavaScript (for Electron) code.",
        },
        {
          id: "security",
          title: "Security is Key",
          icon: <KeyRound />,
          description: "You might wonder if it's safe for your app to talk directly to the database. It is! Security is not handled in the app's code but by Firestore Security Rules, which you define in the Firebase console. This ensures users can only access the data they are permitted to see.",
        },
        {
          id: "getting-started",
          title: "Your Getting Started Checklist",
          icon: <CheckCircle />,
          description: "Follow these steps to connect your native app.",
          list: [
            "Go to your Firebase Console and add a new 'Web' app. This might seem counterintuitive for a desktop app, but for many frameworks (like Electron, .NET, C++), you will use the web libraries.",
            "Firebase will generate a configuration object. We have already generated this for you and placed it in src/lib/firebase-config.ts for your reference.",
            "Install the Firebase SDK into your native application project following the official documentation.",
            "Initialize Firebase in your application using the provided configuration.",
            "Start using Firestore functions to read and write data!"
          ]
        },
    ];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-28 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary drop-shadow-lg">
            Native App Integration Guide
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Connecting your Windows or macOS app to KPI Quest.
          </p>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="w-full py-12 md:py-16 lg:py-20 frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-2xl font-semibold sticky top-24">Concepts</h2>
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
                   {section.list && (
                     <ul className="list-decimal list-inside space-y-3 text-muted-foreground mb-6">
                        {section.list.map((item, index) => <li key={index}>{item}</li>)}
                     </ul>
                   )}
                </div>
              ))}
               <div id="example" className="pt-8 md:pt-12 scroll-mt-20">
                 <h3 className="text-2xl md:text-3xl font-semibold flex items-center gap-3 mb-4">
                    <Code className="h-7 w-7 text-primary"/> Code Example
                 </h3>
                 <p className="text-muted-foreground mb-6 text-base md:text-lg">Here's a conceptual example of how you'd use your Firebase config in a JavaScript-based native app (like Electron).</p>
                 <div className="p-4 border rounded-lg bg-background/30 shadow-inner">
                   <MockCodeSnippet />
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-16 md:py-24 text-center frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Build?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Check out the official Firebase documentation for detailed setup instructions for your platform.
          </p>
           <a href="https://firebase.google.com/docs/web/setup" target="_blank" rel="noopener noreferrer">
             <Button size="lg" variant="default">
                <ExternalLink className="mr-2 h-4 w-4"/>
                View Firebase Docs
             </Button>
            </a>
        </div>
      </section>
    </div>
  );
}
