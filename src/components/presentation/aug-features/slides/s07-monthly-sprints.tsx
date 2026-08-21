"use client";

import { motion } from "framer-motion";
import { CountUp, GlassCard, Kicker, SlideLayout, rise, stagger } from "../ui";

const MONTHS = ["Sep", "Oct", "Nov", "Dec"];

function MonthCard({ month, index }: { month: string; index: number }) {
  return (
    <div className="[perspective:900px]">
      <motion.div
        className="relative h-40 w-28 [transform-style:preserve-3d] md:h-44 md:w-32"
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 180 }}
        transition={{ delay: 1 + index * 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 grid place-items-center rounded-2xl border border-white/15 bg-slate-950/55 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl [backface-visibility:hidden]">
          <div className="text-center">
            <div className="text-2xl font-black uppercase tracking-widest">{month}</div>
            <div className="mt-2 px-3 text-[11px] leading-snug text-white/70">
              division tables reset
            </div>
          </div>
        </div>
        <div className="absolute inset-0 grid place-items-center rounded-2xl border border-amber-300/45 bg-amber-950/60 backdrop-blur-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="text-center">
            <div className="text-4xl">🏆</div>
            <div className="mt-2 px-2 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              Champions ×3
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function S07MonthlySprints() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl"
      >
        <Kicker>Every month is a cup final</Kicker>
        <motion.h1
          variants={rise}
          className="text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-tight tracking-tight"
        >
          Monthly <span className="text-amber-300">title sprints</span>
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-4 max-w-2xl text-lg text-white/65 md:text-xl"
        >
          Top your division&apos;s points table in a month and{" "}
          <span className="font-semibold text-white">you&apos;re that month&apos;s champion</span>{" "}
          — a fresh 30-day race, four times before Christmas.
        </motion.p>

        <motion.div variants={rise} className="mt-10 flex flex-wrap justify-center gap-4">
          {MONTHS.map((m, i) => (
            <MonthCard key={m} month={m} index={i} />
          ))}
        </motion.div>

        <motion.div
          variants={rise}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <GlassCard className="border-amber-300/35 bg-amber-950/50 px-8 py-4 text-center">
            <span className="text-4xl font-black text-amber-300">
              <CountUp to={12} duration={1.4} delay={1.2} />
            </span>
            <span className="ml-2 text-lg font-bold">trophies before Christmas</span>
          </GlassCard>
        </motion.div>
      </motion.div>
    </SlideLayout>
  );
}
