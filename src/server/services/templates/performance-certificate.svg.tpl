<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 1000 1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    <rect x="0" y="0" width="1000" height="1000" style="fill:rgb(44,62,80);"/>

    <!-- Header: logo + KPI name + direction -->
    <!-- Logo: gold circle, left edge aligned with row left edge (x=60) -->
    <circle cx="85" cy="100" r="28" style="fill:rgb(159,143,94);"/>
    <path d="M71,100 L82,112 L100,87" style="stroke:rgb(248,248,248);stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round;"/>

    <!-- KPI Name - starts to the right of the logo -->
    <text x="125" y="108" style="font-family:'ArialMT','Arial',sans-serif;font-size:62px;fill:rgb(248,248,248);">{{KPI_NAME}}</text>

    <!-- Direction text: "Higher is better" or "Lower is better" (no unit, no double word) -->
    <text x="125" y="148" style="font-family:'ArialMT','Arial',sans-serif;font-size:30px;fill:rgb(248,248,248);">{{UNIT_DIRECTION}} is better</text>

    <!-- 5th place (blue) — score only, right-aligned just past bar edge -->
    <g transform="translate(0,575)">
        <path d="M902.314,135 C919.802,135 934,143.29 934,153.5 L934,190.5 C934,200.71 919.802,209 902.314,209 L91.686,209 C74.198,209 60,200.71 60,190.5 L60,153.5 C60,143.29 74.198,135 91.686,135 Z" style="fill:rgb(66,129,164);"/>
        <text x="975" y="185" text-anchor="end" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">{{SCORE_5TH}}</text>
    </g>

    <!-- 4th place (blue) — score only -->
    <g transform="translate(0,475)">
        <path d="M902.314,135 C919.802,135 934,143.29 934,153.5 L934,190.5 C934,200.71 919.802,209 902.314,209 L91.686,209 C74.198,209 60,200.71 60,190.5 L60,153.5 C60,143.29 74.198,135 91.686,135 Z" style="fill:rgb(66,129,164);"/>
        <text x="975" y="185" text-anchor="end" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">{{SCORE_4TH}}</text>
    </g>

    <!-- 3rd place (bronze) — score only -->
    <g transform="translate(0,375)">
        <path d="M902.314,135 C919.802,135 934,143.29 934,153.5 L934,190.5 C934,200.71 919.802,209 902.314,209 L91.686,209 C74.198,209 60,200.71 60,190.5 L60,153.5 C60,143.29 74.198,135 91.686,135 Z" style="fill:rgb(153,107,79);"/>
        <text x="975" y="185" text-anchor="end" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">{{SCORE_3RD}}</text>
    </g>

    <!-- 2nd place (silver) — score only -->
    <g transform="translate(0,275)">
        <path d="M902.314,135 C919.802,135 934,143.29 934,153.5 L934,190.5 C934,200.71 919.802,209 902.314,209 L91.686,209 C74.198,209 60,200.71 60,190.5 L60,153.5 C60,143.29 74.198,135 91.686,135 Z" style="fill:rgb(150,150,150);"/>
        <text x="975" y="185" text-anchor="end" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">{{SCORE_2ND}}</text>
    </g>

    <!-- 1st place (gold) — name + score -->
    <g transform="translate(0,175)">
        <path d="M902.314,135 C919.802,135 934,143.29 934,153.5 L934,190.5 C934,200.71 919.802,209 902.314,209 L91.686,209 C74.198,209 60,200.71 60,190.5 L60,153.5 C60,143.29 74.198,135 91.686,135 Z" style="fill:rgb(159,143,94);"/>
        <text x="96" y="185" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">{{NAME_1ST}}</text>
        <text x="975" y="185" text-anchor="end" style="font-family:'ArialMT','Arial',sans-serif;font-size:40px;fill:rgb(248,248,248);stroke:rgb(13,10,11);stroke-width:2px;">{{SCORE_1ST}}</text>
    </g>
</svg>
