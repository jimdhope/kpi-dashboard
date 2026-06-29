# Certificate Template Guide

This folder contains files to help you customize the certificate appearance.

## Files

### 1. `certificate-template.html` (ROOT FOLDER)
**Open this in your browser to preview changes visually!**

An interactive HTML template that lets you:
- See certificates at 3 different sizes (full, preview, compact)
- Edit winner name, pod name, competition, manager
- Toggle between ranks (gold/silver/bronze)
- Switch between individual and team certificates
- See changes in real-time

**To use:**
```bash
# Open in your browser
open certificate-template.html
# Or drag the file into any browser
```

### 2. `certificate-config.ts` (IN API FOLDER)
**Location:** `src/app/api/certificate/certificate-config.ts`

This is a **reference file** that documents all customizable values:
- Colors (background, text, rank-specific)
- Sizes (dimensions, typography, spacing)
- Content templates (labels, text format)
- Rank configurations (1st/2nd/3rd)
- Full JSX template with comments

**To apply changes to the actual certificate:**
1. Edit the values in `certificate-config.ts` (for reference)
2. Update the actual route file `src/app/api/certificate/route.tsx` to use those values

---

## Quick Customization Guide

### Change Colors
Edit the `COLORS` object in `certificate-config.ts`:

```typescript
export const COLORS = {
  background: "#0f172a",
  // ... add more colors
};
```

### Change Sizes
Edit the `SIZES` object:

```typescript
export const SIZES = {
  trophySize: 64,      // Change trophy emoji size
  nameSize: 52,         // Change winner name size
  padding: 48,          // Change content padding
  // ... etc
};
```

### Change Text
Edit the `TEMPLATES` object:

```typescript
export const TEMPLATES = {
  trophy: "🏆",
  subtitle: "This is to officially recognize",
  positionText: (position) => `for coming ${position} Place during`,
  // ... etc
};
```

### Change Rank Colors
Edit the `RANK_CONFIGS` object:

```typescript
export const RANK_CONFIGS = {
  1: {
    primary: "#d4af37",           // Gold color
    gradient: "linear-gradient(...)", // Gold text gradient
    position: "1st",
  },
  // 2: silver, 3: bronze
};
```

---

## Common Customizations

### 1. Remove "Week" from competition name
In `route.tsx`, change:
```tsx
{competitionName} Week
```
to:
```tsx
{competitionName}
```

### 2. Add more ranks
Add to `RANK_CONFIGS`:
```typescript
4: {
  primary: "#6366f1",  // Purple
  gradient: "linear-gradient(to right, #6366f1, #a5b4fc, #6366f1)",
  position: "4th",
},
```

### 3. Change signature font style
In `route.tsx`, signature divs currently use default font. To use a cursive font like Caveat:
```tsx
<div style={{ fontSize: 18, color: "#e2e8f0", fontFamily: "'Caveat', cursive", ... }}>
```

Note: ImageResponse supports limited fonts. You may need to load fonts via Google Fonts URLs in the `fonts` option of `ImageResponse`.

### 4. Add a logo
Add an `<img>` element in the certificate JSX:
```tsx
<div style={{ display: "flex" }}>
  <img 
    src="https://your-domain.com/logo.png" 
    width={120} 
    height={60} 
    style={{ objectFit: "contain" }} 
  />
</div>
```

---

## Troubleshooting

### Certificate looks different than HTML preview
The HTML preview (`certificate-template.html`) uses CSS for styling, while the actual certificate uses Satori/ImageResponse. Some CSS properties may not work in ImageResponse:
- `radial-gradient` for patterns may not work
- Font support is limited
- Complex layouts may cause crashes

### Certificate crashes with "empty reply"
This usually means there's a Satori validation error. Common causes:
- Missing `display: "flex"` on a div with children
- Invalid CSS values
- Unclosed tags

### Text is cut off
Reduce font sizes or padding in `SIZES` object.

---

## Test Your Changes

After editing `route.tsx`, test with curl:

```bash
# Individual certificate
curl -s -o cert.png "http://localhost:9103/api/certificate?rank=1&name=Test&podName=Pod&date=Date&competitionName=Comp&managerName=Manager&isTeam=false"

# Team certificate
curl -s -o cert-team.png "http://localhost:9103/api/certificate?rank=1&name=Team&podName=Pod&date=Date&competitionName=Comp&managerName=Manager&isTeam=true&members=Alice,Bob,Charlie"
```

Check the PNG:
```bash
file cert.png
# Should output: PNG image data, 1200 x 848
```
