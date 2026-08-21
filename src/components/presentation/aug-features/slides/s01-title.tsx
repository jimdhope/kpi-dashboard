"use client";

import { motion } from "framer-motion";
import {
  Chip,
  GlassCard,
  GradientText,
  Kicker,
  SlideLayout,
  rise,
  stagger,
} from "../ui";

function TeaserCard({
  emoji,
  title,
  sub,
  color,
}: {
  emoji: string;
  title: string;
  sub: string;
  color: string;
}) {
  return (
    <GlassCard className="flex items-center gap-4 px-6 py-5">
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl"
        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
      >
        {emoji}
      </span>
      <span>
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-white/75">{sub}</span>
      </span>
    </GlassCard>
  );
}

export function S01Title() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-5xl text-center"
      >
        <div className="flex justify-center">
          <Kicker>KPI Quest · Autumn Launch</Kicker>
        </div>
        <motion.h1
          variants={rise}
          className="text-[clamp(2.8rem,8vw,7rem)] font-black leading-[0.98] tracking-tight"
        >
          Two game-changers.
          <br />
          <GradientText from="#f5c04e" to="#8b5cf6">
            One huge autumn.
          </GradientText>
        </motion.h1>
        <motion.p
          variants={rise}
          className="mx-auto mt-6 max-w-2xl text-lg text-white/60 md:text-xl"
        >
          Two new ways to race are coming to KPI Quest this autumn. More ways
          to win, more silverware on the line — here&apos;s what&apos;s coming.
        </motion.p>
        <motion.div
          variants={rise}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <TeaserCard
            emoji="⚡"
            title="Beat Your Best"
            sub="Race yourself. Win the week."
            color="#22d3ee"
          />
          <TeaserCard
            emoji="🏆"
            title="The KPI League"
            sub="Three divisions. Twelve trophies."
            color="#fbbf24"
          />
        </motion.div>
        <motion.div variants={rise} className="mt-12">
          <Chip>Press → to begin</Chip>
        </motion.div>
      </motion.div>
    </SlideLayout>
  );
}
