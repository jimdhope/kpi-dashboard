"use client";

import { motion } from "framer-motion";
import { Chip, GradientText, Kicker, SlideLayout, rise, stagger } from "../ui";

export function S10Close() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-4xl text-center"
      >
        <div className="flex justify-center">
          <Kicker>Mark your calendar</Kicker>
        </div>
        <motion.h1
          variants={rise}
          className="text-[clamp(2rem,5vw,4.2rem)] font-black leading-[1.05] tracking-tight"
        >
          Your weekly winners?
          <br />
          <span className="text-white/85">Exactly the same as always.</span>
        </motion.h1>
        <motion.p
          variants={rise}
          className="mx-auto mt-6 max-w-2xl text-lg text-white/60"
        >
          Same app. Same log-ins. Same headline race. Everything you saw today
          is a whole new layer on top.
        </motion.p>

        <motion.div
          variants={rise}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          <Chip tone="#fbbf24">Sep 1 — divisions seeded</Chip>
          <Chip tone="#fbbf24">Month end — champions crowned</Chip>
          <Chip tone="#fbbf24">Dec 31 — reshuffle day</Chip>
        </motion.div>

        <motion.p
          variants={rise}
          className="mt-14 text-[clamp(3rem,9vw,7rem)] font-black leading-none tracking-tight"
        >
          <GradientText from="#fde68a" to="#f59e0b">
            Sep 1. Be there.
          </GradientText>
        </motion.p>
      </motion.div>
    </SlideLayout>
  );
}
