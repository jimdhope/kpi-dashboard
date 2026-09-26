import sharp from "sharp";

export interface PerformanceCertData {
  kpiName: string;
  unitDirection: "Higher" | "Lower";
  entries: {
    rank: "1st" | "2nd" | "3rd" | "4th" | "5th";
    name: string;
    score: string;
  }[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const barPath = "M902.314,135 C919.802,135 934,143.29 934,153.5 L934,190.5 C934,200.71 919.802,209 902.314,209 L91.686,209 C74.198,209 60,200.71 60,190.5 L60,153.5 C60,143.29 74.198,135 91.686,135 Z";

function barTemplate(rank: 1 | 2 | 3 | 4 | 5, color: string, score: string, name?: string): string {
  const nameText = name ? `<text x="96" y="185" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">${escapeXml(name)}</text>` : "";
  return `<g transform="translate(0,${(6 - rank) * 100})">
    <path d="${barPath}" style="fill:rgb(${color});"/>
    ${nameText}
    <text x="975" y="185" text-anchor="end" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">${escapeXml(score)}</text>
</g>`;
}

export function renderPerformanceCertificateSvg(data: PerformanceCertData): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 1000 1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    <rect x="0" y="0" width="1000" height="1000" style="fill:rgb(44,62,80);"/>
    <circle cx="85" cy="100" r="28" style="fill:rgb(159,143,94);"/>
    <path d="M71,100 L82,112 L100,87" style="stroke:rgb(248,248,248);stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round;"/>
    <text x="125" y="108" style="font-family:'ArialMT','Arial',sans-serif;font-size:62px;fill:rgb(248,248,248);">${escapeXml(data.kpiName)}</text>
    <text x="125" y="148" style="font-family:'ArialMT','Arial',sans-serif;font-size:30px;fill:rgb(248,248,248);">${data.unitDirection} is better</text>
    ${barTemplate(5, "66,129,164", data.entries[4]?.score ?? "")}
    ${barTemplate(4, "66,129,164", data.entries[3]?.score ?? "")}
    ${barTemplate(3, "153,107,79", data.entries[2]?.score ?? "")}
    ${barTemplate(2, "150,150,150", data.entries[1]?.score ?? "")}
    ${barTemplate(1, "159,143,94", data.entries[0]?.score ?? "", data.entries[0]?.name ?? "")}
</svg>`;
}

export async function renderPerformanceCertificatePng(data: PerformanceCertData): Promise<Buffer> {
  const svg = renderPerformanceCertificateSvg(data);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
