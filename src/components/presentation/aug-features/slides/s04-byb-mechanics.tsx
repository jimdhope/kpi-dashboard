"use client";

import { motion } from "framer-motion";
import { Chip, GlassCard, Kicker, RatioGauge, SlideLayout, rise, stagger } from "../ui";

function FormulaCard({
  top,
  bottom,
  accent,
}: {
  top: string;
  bottom: string;
  accent: string;
}) {
  return (
    <GlassCard
      className="px-5 py-4 text-center"
      style={{ borderColor: `${accent}66` }}
    >
      <div className="text-sm font-bold uppercase tracking-wider text-white/90">
        {top}
      </div>
      <div className="mt-1 text-xs text-white/75">{bottom}</div>
    </GlassCard>
  );
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <span className="self-center px-1 text-3xl font-black text-sky-300/90">
      {symbol}
    </span>
  );
}

export function S04BybMechanics() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-6xl"
      >
        <Kicker>How it works</Kicker>
        <motion.h1
          variants={rise}
          className="text-[clamp(1.9rem,4vw,3.4rem)] font-black leading-tight tracking-tight"
        >
          Your week, measured against{" "}
          <span className="text-sky-300">your best</span>
        </motion.h1>

        <motion.div variants={rise} className="mt-8 flex flex-wrap items-stretch gap-3">
          <FormulaCard top="This week's points" bottom="what you actually scored" accent="#60a5fa" />
          <Operator symbol="÷" />
          <FormulaCard top="Your best of the last 8 weeks" bottom="your personal high bar" accent="#38bdf8" />
          <Operator symbol="×" />
          <FormulaCard top="100" bottom="turns it into a percentage" accent="#7dd3fc" />
          <Operator symbol="=" />
          <GlassCard
            className="border-sky-300/70 bg-sky-400/10 px-6 py-4 text-center"
          >
            <div className="text-sm font-black uppercase tracking-wider text-sky-200">
              Your score
            </div>
            <div className="mt-1 text-xs text-white/75">
              highest score wins the week
            </div>
          </GlassCard>
        </motion.div>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[auto_1fr]">
          <motion.div variants={rise}>
            <GlassCard className="p-8">
              <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-white/75">
                Worked example
              </p>
              <div className="mt-4 flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-black tabular-nums">850</div>
                  <div className="mt-1 text-xs text-white/75">Alex&apos;s best week</div>
                </div>
                <div className="text-2xl text-white/75">→</div>
                <div className="text-center">
                  <div className="text-3xl font-black tabular-nums text-sky-300">820</div>
                  <div className="mt-1 text-xs text-white/75">this week</div>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <RatioGauge value={96.5} size={170} label="of your best" />
              </div>
            </GlassCard>
          </motion.div>

          <motion.div variants={rise} className="flex flex-col gap-4">
            <Chip tone="#60a5fa">🏆 Highest percentage wins the week</Chip>
            <Chip tone="#60a5fa">✅ Score at least half of the week&apos;s top points to qualify</Chip>
            <Chip tone="#60a5fa">🌱 Brand new? Your first couple of weeks are unranked while you settle in</Chip>
          </motion.div>
        </div>
      </motion.div>
    </SlideLayout>
  );
}
