"use client";

import { motion } from "framer-motion";
import { Kicker, LeagueTableMini, SlideLayout, rise, stagger, type LeagueRow } from "../ui";

const TABLE: LeagueRow[] = [
  { pos: 1, name: "Morgan", pld: 14, pts: 1712, form: [1, 2, 1, 3, 1] },
  { pos: 2, name: "Casey", pld: 14, pts: 1655, form: [2, 1, 2, 1, 2] },
  { pos: 3, name: "Riley", pld: 14, pts: 1580, form: [3, 4, 2, 2, 3] },
  { pos: 4, name: "Sam", pld: 14, pts: 1490, form: [4, 3, 5, 4, 4] },
  { pos: 5, name: "Jordan", pld: 14, pts: 1402, form: [5, 5, 3, 6, 5] },
  { pos: 6, name: "Alex", pld: 14, pts: 1330, form: [6, 6, 4, 5, 6] },
];

export function S08PromotionRelegation() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr]"
      >
        <div>
          <Kicker>Dec 31 · Reshuffle day</Kicker>
          <motion.h1
            variants={rise}
            className="text-[clamp(2rem,4.5vw,3.8rem)] font-black leading-[1.05] tracking-tight"
          >
            Promotion &amp;{" "}
            <span className="text-amber-300">relegation</span>
          </motion.h1>
          <motion.ul
            variants={rise}
            className="mt-8 space-y-4 text-lg text-white/70"
          >
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              Finish top 2 — you move up. Bottom 2 — you move down.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              Life happens: miss lots of the season and you can&apos;t be relegated.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              New to the team? You start in League One.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              Nobody&apos;s ever out — you just start next season one division lower.
            </li>
          </motion.ul>
        </div>

        <div>
          <motion.div variants={rise}>
            <LeagueTableMini rows={TABLE} />
          </motion.div>
          <motion.div
            variants={rise}
            className="mt-4 flex justify-center gap-6 text-xs font-semibold uppercase tracking-wider"
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              Promotion
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
              Relegation
            </span>
          </motion.div>
        </div>
      </motion.div>
    </SlideLayout>
  );
}
