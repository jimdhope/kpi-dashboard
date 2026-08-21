"use client";

import { motion } from "framer-motion";
import { GradientText, Kicker, SlideLayout, rise, stagger } from "../ui";

const DIVISIONS = [
  {
    name: "Premier",
    size: "5 players",
    width: "100%",
    border: "rgba(251,191,36,0.55)",
    bg: "rgba(251,191,36,0.10)",
    text: "#fbbf24",
  },
  {
    name: "Championship",
    size: "4 players",
    width: "86%",
    border: "rgba(203,213,225,0.4)",
    bg: "rgba(203,213,225,0.07)",
    text: "#e2e8f0",
  },
  {
    name: "League One",
    size: "4 players",
    width: "72%",
    border: "rgba(251,146,60,0.45)",
    bg: "rgba(251,146,60,0.08)",
    text: "#fb923c",
  },
];

export function S06LeagueIntro() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl"
      >
        <div className="flex justify-center">
          <Kicker>New · Feature 02</Kicker>
        </div>
        <motion.h1
          variants={rise}
          className="text-center text-[clamp(2.6rem,6.5vw,5.8rem)] font-black leading-[1] tracking-tight"
        >
          <GradientText from="#4ade80" to="#fbbf24">
            The KPI League
          </GradientText>
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-3 text-center text-lg font-semibold uppercase tracking-[0.3em] text-white/70"
        >
          Autumn Cup 2026 · Sep 1 – Dec 31
        </motion.p>

        <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-3">
          {DIVISIONS.map((d) => (
            <motion.div
              key={d.name}
              variants={rise}
              className="flex items-center justify-between rounded-2xl border px-7 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
              style={{
                width: d.width,
                borderColor: d.border,
                background:
                  "linear-gradient(rgba(2,6,23,0.55), rgba(2,6,23,0.55)), " + d.bg,
              }}
            >
              <span
                className="text-xl font-black uppercase tracking-[0.18em]"
                style={{ color: d.text }}
              >
                {d.name}
              </span>
              <span className="text-sm font-semibold text-white/75">{d.size}</span>
            </motion.div>
          ))}
        </div>

        <motion.p
          variants={rise}
          className="mt-10 text-center text-lg text-white/65 md:text-xl"
        >
          On Sep 1 everyone gets placed based on how they&apos;ve been performing.
          <br />
          <span className="font-bold text-emerald-300">
            Everyone plays. Nobody ever leaves.
          </span>
        </motion.p>
      </motion.div>
    </SlideLayout>
  );
}
