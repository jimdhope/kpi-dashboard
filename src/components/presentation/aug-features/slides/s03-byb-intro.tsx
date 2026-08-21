"use client";

import { motion } from "framer-motion";
import { Chip, GradientText, Kicker, RatioGauge, SlideLayout, rise, stagger } from "../ui";

export function S03BybIntro() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.25fr_1fr]"
      >
        <div>
          <Kicker>New · Feature 01</Kicker>
          <motion.h1
            variants={rise}
            className="text-[clamp(2.6rem,6vw,5.5rem)] font-black leading-[1] tracking-tight"
          >
            <GradientText from="#60a5fa" to="#38bdf8">
              Beat Your Best
            </GradientText>
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-6 max-w-xl text-xl leading-relaxed text-white/70 md:text-2xl"
          >
            Your only rival that matters is{" "}
            <span className="font-bold text-sky-300">
              your own best week
            </span>
            . Match it, beat it — and the week is yours, whatever anyone else
            scores.
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
            <Chip tone="#60a5fa">Anyone can win any week</Chip>
            <Chip tone="#60a5fa">In testing: every single player wins</Chip>
            <Chip tone="#60a5fa">Rewards form, not volume</Chip>
          </motion.div>
        </div>
        <motion.div variants={rise} className="flex justify-center lg:justify-end">
          <RatioGauge value={96.5} label="This week vs your best" />
        </motion.div>
      </motion.div>
    </SlideLayout>
  );
}
