"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, Copy, Check } from "lucide-react";

interface DialConfig {
  cx: number;
  cy: number;
  isClockwise: boolean;
  isRed: boolean;
}

const DIALS: DialConfig[] = [
  { cx: 75.04,  cy: 347.05, isClockwise: true,  isRed: false },
  { cx: 161.04, cy: 347.05, isClockwise: false, isRed: false },
  { cx: 247.04, cy: 347.05, isClockwise: true,  isRed: false },
  { cx: 333.04, cy: 347.05, isClockwise: false, isRed: false },
  { cx: 419.04, cy: 347.05, isClockwise: true,  isRed: false },
  { cx: 505.04, cy: 347.05, isClockwise: true,  isRed: true },
];

const VB_W = 625;
const VB_H = 600;

/** Get the digit (0-9) a needle has just passed, given its angle and direction. */
function getPassedDigit(angleDeg: number, isClockwise: boolean): number {
  const norm = ((angleDeg % 360) + 360) % 360;
  if (isClockwise) {
    return Math.floor(norm / 36) % 10;
  } else {
    const ccw = (360 - norm) % 360;
    return Math.floor(ccw / 36) % 10;
  }
}

/** Convert screen coords to SVG viewBox coords. */
function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (VB_W / rect.width),
    y: (clientY - rect.top)  * (VB_H / rect.height),
  };
}

/** Angle from centre to point, 0° = top, positive = clockwise. */
function angleFromTop(cx: number, cy: number, px: number, py: number): number {
  const dx = px - cx;
  const dy = py - cy;
  let deg = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (deg < 0) deg += 360;
  return deg;
}

/* ---- Main component ----------------------------------------------------- */

export function DialMeterGuide() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [angles, setAngles] = useState<number[]>([45, 125, 215, 85, 305, 145]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const digits = angles.map((a, i) => getPassedDigit(a, DIALS[i].isClockwise));
  const integerPart = digits.slice(0, 5).join("");
  const decimalPart = digits[5];
  const fullReading = `${integerPart}.${decimalPart}`;

  const updateAngle = useCallback((idx: number, clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { x: svgX, y: svgY } = clientToSvg(svg, clientX, clientY);
    const dial = DIALS[idx];
    const deg = angleFromTop(dial.cx, dial.cy, svgX, svgY);
    setAngles((prev) => {
      const next = [...prev];
      next[idx] = deg;
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((idx: number, e: React.PointerEvent<SVGGElement>) => {
    e.preventDefault();
    setDraggingIdx(idx);
    updateAngle(idx, e.clientX, e.clientY);
    try { (e.target as SVGElement).setPointerCapture(e.pointerId); } catch {}
  }, [updateAngle]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx !== null) {
      updateAngle(draggingIdx, e.clientX, e.clientY);
    }
  }, [draggingIdx, updateAngle]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx !== null) {
      try { (e.target as SVGElement).releasePointerCapture(e.pointerId); } catch {}
      setDraggingIdx(null);
    }
  }, [draggingIdx]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullReading).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [fullReading]);

  const handleReset = useCallback(() => {
    setAngles(Array(6).fill(0));
  }, []);

  return (
    <Card className="w-full overflow-hidden">

      <CardContent className="pt-4">
        {/* ---- Controls -------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b">
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Reset All
            </Button>
            <Button size="sm" onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy Reading"}
            </Button>
          </div>
        </div>

        {/* ---- SVG dials ------------------------------------------------------- */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full max-w-2xl mx-auto select-none touch-none"
          style={{ fillRule: "evenodd", clipRule: "evenodd", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: 1.5 }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* =====  Original SVG content (verbatim, React-style attrs)  ===== */}

          {/* Outer meter frame box */}
          <g transform="matrix(1,0,0,0.853874,-190.5,-147.314676)">
            <path
              d="M801,371.5L801,676.5C801,760.667 742.652,829 670.784,829L335.216,829C263.348,829 205,760.667 205,676.5L205,371.5C205,287.333 263.348,219 335.216,219L670.784,219C742.652,219 801,287.333 801,371.5Z"
              fill="#EFEFE6"
              stroke="#121212"
              strokeWidth="4.3"
            />
          </g>

          {/* Jabi branding atom icon */}
          <g transform="matrix(0.054351,0,0,0.054351,167.951216,135.170265)">
            <g transform="matrix(1,0,0,1,-1967.5,-1375)">
              <g transform="matrix(0.869421,0,0,0.869421,-66.53722,348.99308)">
                <path d="M517.254,957.229C451.568,937.738 394.711,942.003 358.159,974.768C271.133,1052.781 332.176,1262.82 494.504,1443.903C656.831,1624.986 858.973,1708.54 946,1630.527C1006.048,1576.698 995.6,1460.011 930.026,1333.352" fill="none" stroke="#1E1E1E" strokeWidth="41.74" strokeLinecap="butt" strokeMiterlimit="4"/>
                <path d="M233.274,1313.555C220.293,1340.47 215.896,1367.67 221.488,1393.963C245.803,1508.281 458.344,1559.94 696.213,1509.347C934.082,1458.754 1107.202,1325.067 1082.887,1210.75C1058.573,1096.432 837.432,1046.994 599.563,1097.587" fill="none" stroke="#1E1E1E" strokeWidth="41.74" strokeLinecap="butt" strokeMiterlimit="4"/>
                <path d="M840.563,1380.887C905.033,1169.381 918.608,957.552 820.526,892.208M658.878,914.722C578.866,970.956 503.211,1092.69 454.852,1240.628C379.291,1471.781 411.108,1698.002 522.198,1734.316C570.1,1749.975 621.697,1723.864 675.258,1676.988" fill="none" stroke="#1E1E1E" strokeWidth="41.74" strokeLinecap="butt" strokeMiterlimit="4"/>
                <path d="M782.679,1305.748C782.679,1233.819 724.368,1175.508 652.438,1175.508C580.509,1175.508 522.198,1233.819 522.198,1305.748C522.198,1377.678 580.509,1435.988 652.438,1435.988C724.368,1435.988 782.679,1377.678 782.679,1305.748Z" fill="#FE4A49"/>
                <path d="M769.321,884.416C769.321,839.844 733.188,803.711 688.616,803.711C644.044,803.711 607.912,839.844 607.912,884.416C607.912,928.988 644.044,965.12 688.616,965.12C733.188,965.12 769.321,928.988 769.321,884.416Z" fill="#FE4A49"/>
                <path d="M310.697,1300.182C310.697,1255.611 274.565,1219.478 229.993,1219.478C185.421,1219.478 149.288,1255.611 149.288,1300.182C149.288,1344.754 185.421,1380.887 229.993,1380.887C274.565,1380.887 310.697,1344.754 310.697,1300.182Z" fill="#FE4A49"/>
                <path d="M892.882,1653.612C892.882,1609.04 856.749,1572.907 812.177,1572.907C767.606,1572.907 731.473,1609.04 731.473,1653.612C731.473,1698.184 767.606,1734.316 812.177,1734.316C856.749,1734.316 892.882,1698.184 892.882,1653.612Z" fill="#FE4A49"/>
                <g transform="matrix(1,0,0,1,1353,1666)">
                  <path d="M566.382,-949.005L566.382,-290.743C566.382,-263.053 564.914,-237.461 561.977,-213.967C559.04,-190.472 554.215,-170.334 547.503,-153.552C536.595,-126.702 521.701,-102.159 502.821,-79.923C483.942,-57.687 461.916,-38.808 436.743,-23.285C411.571,-7.762 383.671,4.405 353.045,13.216C322.418,22.026 290.323,26.431 256.76,26.431C155.231,26.431 72.581,-20.138 8.81,-113.276L169.915,-278.157C174.11,-249.628 183.34,-226.972 197.604,-210.191C211.869,-193.409 229.49,-185.018 250.467,-185.018C296.616,-185.018 319.691,-221.518 319.691,-294.519L319.691,-949.005L566.382,-949.005Z" fill="#1E1E1E"/>
                  <path d="M956.556,-324.726C956.556,-303.749 960.332,-284.24 967.884,-266.2C975.436,-248.159 985.715,-232.426 998.72,-219.001C1011.726,-205.576 1027.249,-195.087 1045.29,-187.535C1063.33,-179.984 1082.839,-176.208 1123.954,-176.208C1123.954,-176.208 1143.043,-179.984 1161.083,-187.535C1179.123,-195.087 1194.647,-205.576 1207.652,-219.001C1220.658,-232.426 1231.147,-247.949 1239.118,-265.57C1247.089,-283.191 1251.075,-302.07 1251.075,-322.208C1251.075,-342.346 1247.089,-361.436 1239.118,-379.476C1231.147,-397.516 1220.658,-413.249 1207.652,-426.674C1194.647,-440.1 1179.123,-450.588 1161.083,-458.14C1143.043,-465.692 1123.954,-469.468 1103.816,-469.468C1082.839,-469.468 1063.33,-465.692 1045.29,-458.14C1027.249,-450.1 1011.726,-440.1 998.72,-426.674C985.715,-413.533 975.436,-397.936 967.884,-380.735C960.332,-363.533 956.556,-344.864 956.556,-324.726ZM1243.523,-645.676L1472.593,-645.676L1472.593,0L1243.523,0L1243.523,-71.742C1194.856,-10.489 1128.988,20.138 1045.919,20.138C998.93,20.138 955.717,11.537 916.28,-5.664C876.843,-22.865 842.441,-46.989 813.073,-78.035C783.705,-109.081 760.84,-145.581 744.478,-187.535C728.116,-229.49 719.934,-275.22 719.934,-324.726C719.934,-370.875 727.906,-414.718 743.848,-456.252C759.791,-497.787 782.027,-534.077 810.556,-565.123C839.084,-596.17 873.067,-620.713 912.504,-638.753C951.941,-656.793 995.574,-665.814 1043.402,-665.814C1123.954,-665.814 1190.661,-637.704 1243.523,-581.486L1243.523,-645.676Z" fill="#1E1E1E"/>
                  <path d="M2142.183,-320.95C2142.183,-341.088 2138.407,-360.177 2130.855,-378.217C2123.303,-396.258 2112.815,-411.99 2099.389,-425.416C2085.964,-438.841 2070.441,-449.54 2052.82,-457.511C2035.199,-465.482 2015.9,-469.468 1994.923,-469.468C1974.785,-469.468 1955.906,-465.692 1938.285,-458.14C1920.664,-450.588 1905.351,-440.1 1892.345,-426.674C1879.339,-413.249 1868.851,-397.516 1860.88,-379.476C1852.908,-361.436 1848.923,-342.346 1848.923,-322.208C1848.923,-302.07 1852.699,-283.191 1860.25,-265.57C1867.802,-247.949 1878.291,-232.636 1891.716,-219.63C1905.141,-206.625 1920.874,-196.136 1938.914,-188.165C1956.955,-180.193 1976.044,-176.208 1996.182,-176.208C2016.32,-176.208 2035.199,-179.984 2052.82,-187.535C2070.441,-195.087 2085.754,-205.576 2098.76,-219.001C2111.766,-232.426 2122.254,-247.949 2130.226,-265.57C2138.197,-283.191 2142.183,-301.651 2142.183,-320.95ZM1855.216,-1044.66L1855.216,-581.486C1908.917,-637.704 1976.044,-665.814 2056.596,-665.814C2104.424,-665.814 2148.266,-656.793 2188.123,-638.753C2227.979,-620.713 2261.962,-596.379 2290.071,-565.753C2318.181,-535.126 2340.207,-499.046 2356.149,-457.511C2372.092,-415.976 2380.063,-371.714 2380.063,-324.726C2380.063,-276.898 2371.882,-232.007 2355.52,-190.053C2339.158,-148.098 2316.293,-111.598 2286.925,-80.552C2257.557,-49.506 2222.945,-24.963 2183.088,-6.922C2143.232,11.118 2100.228,20.138 2054.079,20.138C1970.17,20.138 1903.883,-10.489 1855.216,-71.742L1855.216,0L1627.404,0L1627.404,-1044.66L1855.216,-1044.66Z" fill="#1E1E1E"/>
                  <rect x="2509.702" y="-645.676" width="227.811" height="645.676" fill="#1E1E1E"/>
                  <path d="M2494.598,-893.625C2494.598,-911.246 2497.955,-927.818 2504.667,-943.341C2511.38,-958.864 2520.61,-972.499 2532.357,-984.246C2544.104,-995.993 2557.739,-1005.223 2573.262,-1011.936C2588.785,-1018.649 2605.357,-1022.005 2622.978,-1022.005C2640.599,-1022.005 2657.171,-1018.649 2672.694,-1011.936C2688.217,-1005.223 2701.852,-995.993 2713.599,-984.246C2725.346,-972.499 2734.576,-958.864 2741.289,-943.341C2748.002,-927.818 2751.358,-911.246 2751.358,-893.625C2751.358,-876.004 2748.002,-859.432 2741.289,-843.909C2734.576,-828.386 2725.346,-814.751 2713.599,-803.004C2701.852,-791.257 2688.217,-782.027 2672.694,-775.314C2657.171,-768.601 2640.599,-765.245 2622.978,-765.245C2605.357,-765.245 2588.785,-768.601 2573.262,-775.314C2557.739,-782.027 2544.104,-791.257 2532.357,-803.004C2520.61,-814.751 2511.38,-828.386 2504.667,-843.909C2497.955,-859.432 2494.598,-876.004 2494.598,-893.625Z" fill="#FE4A49"/>
                  <path d="M2882.255,-120.828C2882.255,-140.966 2886.031,-160.055 2893.583,-178.096C2901.135,-196.136 2911.623,-211.869 2925.049,-225.294C2938.474,-238.72 2954.207,-249.208 2972.247,-256.76C2990.287,-264.312 3009.377,-268.087 3029.515,-268.087C3049.653,-268.087 3068.742,-264.312 3086.782,-256.76C3104.822,-249.208 3120.555,-238.72 3133.981,-225.294C3147.406,-211.869 3157.894,-196.136 3165.446,-178.096C3172.998,-160.055 3176.774,-140.966 3176.774,-120.828C3176.774,-100.69 3172.998,-81.601 3165.446,-63.561C3157.894,-45.52 3147.406,-29.787 3133.981,-16.362C3120.555,-2.937 3104.822,7.552 3086.782,15.104C3068.742,22.655 3049.653,26.431 3029.515,26.431C3009.377,26.431 2990.287,22.655 2972.247,15.104C2954.207,7.552 2938.474,-2.937 2925.049,-16.362C2911.623,-29.787 2901.135,-45.52 2893.583,-63.561C2886.031,-81.601 2882.255,-100.69 2882.255,-120.828Z" fill="#1E1E1E"/>
                </g>
              </g>
            </g>
          </g>

          {/* Text labels */}
          <g transform="matrix(1,0,0,1,-191.197904,-155.310203)">
            <text x="479" y="313" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="69.333">Metering</text>
          </g>
          <g transform="matrix(1,0,0,1,-73.773347,-152.420783)">
            <text x="263" y="381" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="53.05">Dial Meter</text>
          </g>
          <g transform="matrix(1,0,0,1,-187.5,-153)">
            <text x="292.737" y="644.498" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="53.05">DMC 23 53 42 06</text>
          </g>
          <g transform="matrix(1,0,0,1,-165.5,-153)">
            <text x="711.634" y="509.831" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="26.667">kWh</text>
          </g>

          {/* =====  Dial 6 (decimal, red)  ===== */}
          <g transform="matrix(1,0,0,1,366.5,304)">
            <g transform="matrix(1.056338,0,0,1.056338,81.211268,-1.894366)">
              <circle cx="49.5" cy="42.5" r="35.5" fill="#EBEBEB" stroke="#000" strokeWidth="0.88"/>
            </g>
            <g transform="matrix(0.987193,-0.159529,0.159529,0.987193,91.93367,20.847343)">
              <g transform="matrix(0.98419,0.177115,-0.177115,0.98419,1.761237,-6.545519)"><text x="37.545" y="6.593" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">0</text></g>
              <g transform="matrix(0.745753,0.666222,-0.666222,0.745753,19.905871,-31.268986)"><text x="50.921" y="10.446" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">1</text></g>
              <g transform="matrix(0.156463,0.987684,-0.987684,0.156463,71.407086,-41.604313)"><text x="60.06" y="21.003" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">2</text></g>
              <g transform="matrix(-0.518893,0.854839,-0.854839,-0.518893,121.716748,1.453386)"><text x="60.449" y="34.978" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">3</text></g>
              <g transform="matrix(-0.909641,0.415396,-0.415396,-0.909641,118.230911,66.17676)"><text x="51.918" y="45.948" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">4</text></g>
              <g transform="matrix(-0.991228,-0.132163,0.132163,-0.991228,70.387941,105.449152)"><text x="38.693" y="50.389" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">5</text></g>
              <g transform="matrix(-0.765095,-0.643918,0.643918,-0.765095,13.854344,99.583361)"><text x="25.091" y="47.265" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">6</text></g>
              <g transform="matrix(-0.206866,-0.978369,0.978369,-0.206866,-17.773947,59.893246)"><text x="15.39" y="37.151" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">7</text></g>
              <g transform="matrix(0.46764,-0.883919,0.883919,0.46764,-12.979452,24.897992)"><text x="14.18" y="23.224" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">8</text></g>
              <g transform="matrix(0.892827,-0.450401,0.450401,0.892827,-2.922423,11.192849)"><text x="22.058" y="11.737" fill="#E74C3C" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">9</text></g>
            </g>
            <g transform="matrix(0.48454,0.129832,-0.129832,0.48454,101.332761,-5.106366)">
              <path d="M84.744,20.387L84.744,18.113L96.75,18.113L96.75,16L100,19.25L96.75,22.5L96.75,20.387L84.744,20.387Z" fill="#E74C3C"/>
            </g>
          </g>

          {/* =====  Dial 5 (1s, CW, black)  ===== */}
          <g transform="matrix(1,0,0,1,281.5,304)">
            <g transform="matrix(1.056338,0,0,1.056338,81.211268,-1.894366)">
              <circle cx="49.5" cy="42.5" r="35.5" fill="#EBEBEB" stroke="#000" strokeWidth="0.88"/>
            </g>
            <g transform="matrix(0.987193,-0.159529,0.159529,0.987193,91.93367,20.847343)">
              <g transform="matrix(0.98419,0.177115,-0.177115,0.98419,1.761237,-6.545519)"><text x="37.545" y="6.593" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">0</text></g>
              <g transform="matrix(0.745753,0.666222,-0.666222,0.745753,19.905871,-31.268986)"><text x="50.921" y="10.446" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">1</text></g>
              <g transform="matrix(0.156463,0.987684,-0.987684,0.156463,71.407086,-41.604313)"><text x="60.06" y="21.003" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">2</text></g>
              <g transform="matrix(-0.518893,0.854839,-0.854839,-0.518893,121.716748,1.453386)"><text x="60.449" y="34.978" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">3</text></g>
              <g transform="matrix(-0.909641,0.415396,-0.415396,-0.909641,118.230911,66.17676)"><text x="51.918" y="45.948" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">4</text></g>
              <g transform="matrix(-0.991228,-0.132163,0.132163,-0.991228,70.387941,105.449152)"><text x="38.693" y="50.389" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">5</text></g>
              <g transform="matrix(-0.765095,-0.643918,0.643918,-0.765095,13.854344,99.583361)"><text x="25.091" y="47.265" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">6</text></g>
              <g transform="matrix(-0.206866,-0.978369,0.978369,-0.206866,-17.773947,59.893246)"><text x="15.39" y="37.151" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">7</text></g>
              <g transform="matrix(0.46764,-0.883919,0.883919,0.46764,-12.979452,24.897992)"><text x="14.18" y="23.224" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">8</text></g>
              <g transform="matrix(0.892827,-0.450401,0.450401,0.892827,-2.922423,11.192849)"><text x="22.058" y="11.737" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">9</text></g>
            </g>
            <g transform="matrix(0.48454,0.129832,-0.129832,0.48454,101.332761,-5.106366)">
              <path d="M84.744,20.387L84.744,18.113L96.75,18.113L96.75,16L100,19.25L96.75,22.5L96.75,20.387L84.744,20.387Z" fill="#111111"/>
            </g>
          </g>

          {/* =====  Dial 4 (10s, CCW, black)  ===== */}
          <g transform="matrix(1,0,0,1,197,304)">
            <g transform="matrix(1.056338,0,0,1.056338,81.211268,-1.894366)">
              <circle cx="49.5" cy="42.5" r="35.5" fill="#EBEBEB" stroke="#000" strokeWidth="0.88"/>
            </g>
            <g transform="matrix(0.986325,-0.164809,0.164809,0.986325,91.81573,21.070074)">
              <g transform="matrix(0.98419,0.177115,-0.177115,0.98419,1.761237,-6.545519)"><text x="37.545" y="6.593" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">0</text></g>
              <g transform="matrix(0.727701,0.685894,-0.685894,0.727701,20.997461,-32.160521)"><text x="51.003" y="10.365" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">9</text></g>
              <g transform="matrix(0.147985,0.98899,-0.98899,0.147985,71.981588,-41.540762)"><text x="60.1" y="21.006" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">8</text></g>
              <g transform="matrix(-0.520243,0.854018,-0.854018,-0.520243,121.783112,1.530622)"><text x="60.462" y="34.972" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">7</text></g>
              <g transform="matrix(-0.913774,0.406222,-0.406222,-0.913774,118.048251,66.933849)"><text x="51.92" y="45.996" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">6</text></g>
              <g transform="matrix(-0.991228,-0.132163,0.132163,-0.991228,70.387941,105.449152)"><text x="38.693" y="50.389" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">5</text></g>
              <g transform="matrix(-0.77075,-0.637137,0.637137,-0.77075,14.357417,99.603673)"><text x="25.098" y="47.219" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">4</text></g>
              <g transform="matrix(-0.209363,-0.977838,0.977838,-0.209363,-17.703408,59.994073)"><text x="15.403" y="37.154" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">3</text></g>
              <g transform="matrix(0.460526,-0.887646,0.887646,0.460526,-12.969635,25.15419)"><text x="14.209" y="23.247" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">2</text></g>
              <g transform="matrix(0.881534,-0.472121,0.472121,0.881534,-2.963184,11.842587)"><text x="22.116" y="11.826" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">1</text></g>
            </g>
            <g transform="matrix(-0.48454,0.129832,-0.129832,-0.48454,172.848801,14.3872)">
              <path d="M84.744,20.387L84.744,18.113L96.75,18.113L96.75,16L100,19.25L96.75,22.5L96.75,20.387L84.744,20.387Z" fill="#111111"/>
            </g>
          </g>

          {/* =====  Dial 3 (100s, CW, black)  ===== */}
          <g transform="matrix(1,0,0,1,111.5,304)">
            <g transform="matrix(1.056338,0,0,1.056338,81.211268,-1.894366)">
              <circle cx="49.5" cy="42.5" r="35.5" fill="#EBEBEB" stroke="#000" strokeWidth="0.88"/>
            </g>
            <g transform="matrix(0.987193,-0.159529,0.159529,0.987193,91.93367,20.847343)">
              <g transform="matrix(0.98419,0.177115,-0.177115,0.98419,1.761237,-6.545519)"><text x="37.545" y="6.593" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">0</text></g>
              <g transform="matrix(0.745753,0.666222,-0.666222,0.745753,19.905871,-31.268986)"><text x="50.921" y="10.446" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">1</text></g>
              <g transform="matrix(0.156463,0.987684,-0.987684,0.156463,71.407086,-41.604313)"><text x="60.06" y="21.003" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">2</text></g>
              <g transform="matrix(-0.518893,0.854839,-0.854839,-0.518893,121.716748,1.453386)"><text x="60.449" y="34.978" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">3</text></g>
              <g transform="matrix(-0.909641,0.415396,-0.415396,-0.909641,118.230911,66.17676)"><text x="51.918" y="45.948" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">4</text></g>
              <g transform="matrix(-0.991228,-0.132163,0.132163,-0.991228,70.387941,105.449152)"><text x="38.693" y="50.389" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">5</text></g>
              <g transform="matrix(-0.765095,-0.643918,0.643918,-0.765095,13.854344,99.583361)"><text x="25.091" y="47.265" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">6</text></g>
              <g transform="matrix(-0.206866,-0.978369,0.978369,-0.206866,-17.773947,59.893246)"><text x="15.39" y="37.151" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">7</text></g>
              <g transform="matrix(0.46764,-0.883919,0.883919,0.46764,-12.979452,24.897992)"><text x="14.18" y="23.224" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">8</text></g>
              <g transform="matrix(0.892827,-0.450401,0.450401,0.892827,-2.922423,11.192849)"><text x="22.058" y="11.737" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">9</text></g>
            </g>
            <g transform="matrix(0.48454,0.129832,-0.129832,0.48454,101.332761,-5.106366)">
              <path d="M84.744,20.387L84.744,18.113L96.75,18.113L96.75,16L100,19.25L96.75,22.5L96.75,20.387L84.744,20.387Z" fill="#111111"/>
            </g>
          </g>

          {/* =====  Dial 2 (1,000s, CCW, black)  ===== */}
          <g transform="matrix(1,0,0,1,26.5,304)">
            <g transform="matrix(1.056338,0,0,1.056338,81.211268,-1.894366)">
              <circle cx="49.5" cy="42.5" r="35.5" fill="#EBEBEB" stroke="#000" strokeWidth="0.88"/>
            </g>
            <g transform="matrix(0.986325,-0.164809,0.164809,0.986325,91.81573,21.070074)">
              <g transform="matrix(0.98419,0.177115,-0.177115,0.98419,1.761237,-6.545519)"><text x="37.545" y="6.593" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">0</text></g>
              <g transform="matrix(0.727701,0.685894,-0.685894,0.727701,20.997461,-32.160521)"><text x="51.003" y="10.365" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">9</text></g>
              <g transform="matrix(0.147985,0.98899,-0.98899,0.147985,71.981588,-41.540762)"><text x="60.1" y="21.006" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">8</text></g>
              <g transform="matrix(-0.520243,0.854018,-0.854018,-0.520243,121.783112,1.530622)"><text x="60.462" y="34.972" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">7</text></g>
              <g transform="matrix(-0.913774,0.406222,-0.406222,-0.913774,118.048251,66.933849)"><text x="51.92" y="45.996" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">6</text></g>
              <g transform="matrix(-0.991228,-0.132163,0.132163,-0.991228,70.387941,105.449152)"><text x="38.693" y="50.389" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">5</text></g>
              <g transform="matrix(-0.77075,-0.637137,0.637137,-0.77075,14.357417,99.603673)"><text x="25.098" y="47.219" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">4</text></g>
              <g transform="matrix(-0.209363,-0.977838,0.977838,-0.209363,-17.703408,59.994073)"><text x="15.403" y="37.154" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">3</text></g>
              <g transform="matrix(0.460526,-0.887646,0.887646,0.460526,-12.969635,25.15419)"><text x="14.209" y="23.247" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">2</text></g>
              <g transform="matrix(0.881534,-0.472121,0.472121,0.881534,-2.963184,11.842587)"><text x="22.116" y="11.826" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">1</text></g>
            </g>
            <g transform="matrix(-0.48454,0.129832,-0.129832,-0.48454,172.848801,14.39435)">
              <path d="M84.744,20.387L84.744,18.113L96.75,18.113L96.75,16L100,19.25L96.75,22.5L96.75,20.387L84.744,20.387Z" fill="#111111"/>
            </g>
          </g>

          {/* =====  Dial 1 (10,000s, CW, black)  ===== */}
          <g transform="matrix(1,0,0,1,-58.5,304)">
            <g transform="matrix(1.056338,0,0,1.056338,81.211268,-1.894366)">
              <circle cx="49.5" cy="42.5" r="35.5" fill="#EBEBEB" stroke="#000" strokeWidth="0.88"/>
            </g>
            <g transform="matrix(0.987193,-0.159529,0.159529,0.987193,91.93367,20.847343)">
              <g transform="matrix(0.98419,0.177115,-0.177115,0.98419,1.761237,-6.545519)"><text x="37.545" y="6.593" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">0</text></g>
              <g transform="matrix(0.745753,0.666222,-0.666222,0.745753,19.905871,-31.268986)"><text x="50.921" y="10.446" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">1</text></g>
              <g transform="matrix(0.156463,0.987684,-0.987684,0.156463,71.407086,-41.604313)"><text x="60.06" y="21.003" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">2</text></g>
              <g transform="matrix(-0.518893,0.854839,-0.854839,-0.518893,121.716748,1.453386)"><text x="60.449" y="34.978" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">3</text></g>
              <g transform="matrix(-0.909641,0.415396,-0.415396,-0.909641,118.230911,66.17676)"><text x="51.918" y="45.948" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">4</text></g>
              <g transform="matrix(-0.991228,-0.132163,0.132163,-0.991228,70.387941,105.449152)"><text x="38.693" y="50.389" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">5</text></g>
              <g transform="matrix(-0.765095,-0.643918,0.643918,-0.765095,13.854344,99.583361)"><text x="25.091" y="47.265" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">6</text></g>
              <g transform="matrix(-0.206866,-0.978369,0.978369,-0.206866,-17.773947,59.893246)"><text x="15.39" y="37.151" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">7</text></g>
              <g transform="matrix(0.46764,-0.883919,0.883919,0.46764,-12.979452,24.897992)"><text x="14.18" y="23.224" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">8</text></g>
              <g transform="matrix(0.892827,-0.450401,0.450401,0.892827,-2.922423,11.192849)"><text x="22.058" y="11.737" fill="#1F1F1F" fontFamily="'ArialMT', 'Arial', sans-serif" fontSize="16.667">9</text></g>
            </g>
            <g transform="matrix(0.48454,0.129832,-0.129832,0.48454,101.332761,-5.102791)">
              <path d="M84.744,20.387L84.744,18.113L96.75,18.113L96.75,16L100,19.25L96.75,22.5L96.75,20.387L84.744,20.387Z" fill="#111111"/>
            </g>
          </g>

          {/* =====  Needle overlays (React-rendered, on top)  ===== */}
          {DIALS.map((dial, idx) => {
            const isDraggingThis = draggingIdx === idx;
            const color = dial.isRed ? "#E74C3C" : "#121212";
            const angle = angles[idx];

            return (
              <g
                key={`needle-${idx}`}
                transform={`translate(${dial.cx}, ${dial.cy}) rotate(${angle})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handlePointerDown(idx, e)}
              >
                {/* Invisible hit circle for easier grabbing */}
                <circle cx="0" cy="0" r="40" fill="transparent" />

                {/* Needle line */}
                <line
                  x1="0" y1="6"
                  x2="0" y2="-28"
                  stroke={color}
                  strokeWidth={isDraggingThis ? 3 : 2.2}
                  strokeLinecap="round"
                />

                {/* Arrow head */}
                <polygon
                  points="0,-35 -3.5,-24 3.5,-24"
                  fill={color}
                />

                {/* Tail weight */}
                <circle cx="0" cy="6" r="3" fill={color} />

                {/* Center pivot */}
                <circle cx="0" cy="0" r="4.5" fill={color} stroke="#FFF" strokeWidth="1" />
              </g>
            );
          })}
        </svg>

        {/* ---- Reading display ----------------------------------------------- */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4 bg-muted/30 rounded-xl p-4 border">
          <div className="flex items-baseline gap-1 font-mono text-3xl sm:text-4xl font-bold tabular-nums">
            <span className="text-foreground">{integerPart}</span>
            <span className="text-red-500">.</span>
            <span className="text-red-400">{decimalPart}</span>
            <span className="text-sm font-sans font-normal text-muted-foreground ml-2">kWh</span>
          </div>
        </div>

        {/* ---- Instructions --------------------------------------------------- */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Drag the needles on the dials to set the reading. Use +/− to fine-tune each dial.
        </p>
      </CardContent>
    </Card>
  );
}
