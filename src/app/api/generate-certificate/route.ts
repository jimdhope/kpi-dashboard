
// src/app/api/generate-certificate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

// Helper function to  construct absolute paths to font files
// Corrected to use process.cwd() which points to the project root in Next.js
const getFontPath = (fontFilename: string) => {
    // Assuming fonts are in `public/fonts/` relative to the project root
    return path.join(process.cwd(), 'public', 'fonts', fontFilename);
};


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { svgContent, width = 1123, height = 794 } = body;

    if (!svgContent) {
      return NextResponse.json({ error: 'svgContent is required' }, { status: 400 });
    }

    // --- Register Fonts ---
    // Ensure these .ttf files exist in the specified paths
    try {
        console.log("Attempting to register Inter-Regular.ttf from:", getFontPath('Inter-Regular.ttf'));
        registerFont(getFontPath('Inter-Regular.ttf'), { family: 'Inter', weight: 'normal' });

        console.log("Attempting to register Inter-Bold.ttf from:", getFontPath('Inter-Bold.ttf'));
        registerFont(getFontPath('Inter-Bold.ttf'), { family: 'Inter', weight: 'bold' });

        console.log("Attempting to register DancingScript-Bold.ttf from:", getFontPath('DancingScript-Bold.ttf'));
        registerFont(getFontPath('DancingScript-Bold.ttf'), { family: 'Dancing Script', weight: 'bold' });
        
        // Attempt to register Brush Script MT if you have the .ttf file
        // Make sure 'BrushScriptMT.ttf' is the correct filename and it's in public/fonts/
        try {
             console.log("Attempting to register BrushScriptMT.ttf from:", getFontPath('BrushScriptMT.ttf'));
             registerFont(getFontPath('BrushScriptMT.ttf'), { family: 'Brush Script MT' });
        } catch (brushScriptError) {
             console.warn("Could not register Brush Script MT, it might not be available. Falling back to generic cursive if needed.", brushScriptError);
        }

        console.log("Fonts registered successfully (or attempted).");
    } catch (fontError: any) {
        console.error("CRITICAL: Error registering fonts with node-canvas:", fontError.message, fontError.stack);
        // Even if font registration fails, try to proceed, canvas might use fallbacks
        // return NextResponse.json({ error: `Font registration failed: ${fontError.message}` }, { status: 500 });
    }
    // --- End Font Registration ---


    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background for JPG (SVGs can have transparent backgrounds)
    ctx.fillStyle = '#ffffff'; // White background, or choose another
    ctx.fillRect(0, 0, width, height);

    // Convert SVG string to a data URL that loadImage can understand
    // Ensure the SVG has the xmlns attribute for proper parsing by node-canvas
    const svgWithXmlns = svgContent.includes('xmlns=') ? svgContent : svgContent.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const imageDataSource = `data:image/svg+xml;base64,${Buffer.from(svgWithXmlns).toString('base64')}`;

    const image = await loadImage(imageDataSource);
    ctx.drawImage(image, 0, 0, width, height);

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 }); // 0.9 quality

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="certificate.jpg"`,
      },
    });

  } catch (error: any) {
    console.error("[API/generate-certificate] Error:", error.message, error.stack);
    // Try to send a more informative error message
    let errorMessage = "Failed to generate certificate.";
    if (error.message) {
        errorMessage += ` Details: ${error.message}`;
    }
    if (error.code) {
        errorMessage += ` (Code: ${error.code})`;
    }
    // If it's a known canvas/font issue, provide specific feedback
    if (error.message && (error.message.includes('font') || error.message.includes('Pango'))) {
        errorMessage = "A font rendering issue occurred on the server. Please check server logs for font availability.";
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
