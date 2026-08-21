"use client";

import { motion } from "framer-motion";
import { DashboardMockup } from "../dashboard-mockup";
import { Kicker, SlideLayout, rise, stagger } from "../ui";

export function S05BybExperience() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]"
      >
        <div>
          <Kicker>New · On your dashboard</Kicker>
          <motion.h1
            variants={rise}
            className="text-[clamp(2rem,4.5vw,3.8rem)] font-black leading-[1.05] tracking-tight"
          >
            Live on your dashboard.
            <br />
            <span className="text-sky-300">Watch it climb as you log.</span>
          </motion.h1>
          <motion.ul
            variants={rise}
            className="mt-8 space-y-4 text-lg text-white/70"
          >
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-300" />
              Sits right beside the leaderboard, updating live as you log
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-300" />
              Crack{" "}
              <span className="font-bold text-emerald-300">over 100%</span> and
              you&apos;ve just set a brand-new personal best
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-300" />
              Every logged point moves your number — no waiting for week end
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-300" />
              We&apos;ll switch it on soon — keep an eye out
            </li>
          </motion.ul>
        </div>
        <motion.div variants={rise} className="flex justify-center lg:justify-end">
          <DashboardMockup highlight="byb" />
        </motion.div>
      </motion.div>
    </SlideLayout>
  );
}
