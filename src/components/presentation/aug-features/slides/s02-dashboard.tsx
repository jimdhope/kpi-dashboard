"use client";

import { motion } from "framer-motion";
import { DashboardMockup } from "../dashboard-mockup";
import { GradientText, Kicker, SlideLayout, rise, stagger } from "../ui";

export function S02Dashboard() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div>
          <Kicker>First — your new home</Kicker>
          <motion.h1
            variants={rise}
            className="text-[clamp(2.2rem,5vw,4.4rem)] font-black leading-[1.02] tracking-tight"
          >
            Welcome to{" "}
            <GradientText from="#2dd4bf" to="#5eead4">
              your dashboard
            </GradientText>
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-4 max-w-md text-lg leading-relaxed text-white/65"
          >
            Everything about your week lives on one page — log your work,
            watch the standings move, and track your own form.
          </motion.p>
          <motion.p
            variants={rise}
            className="mt-6 max-w-md text-base font-semibold text-teal-200/90"
          >
            This is the real thing — and the two big features we&apos;re about
            to show you plug straight into it.
          </motion.p>
        </div>
        <motion.div variants={rise}>
          <DashboardMockup />
        </motion.div>
      </motion.div>
    </SlideLayout>
  );
}
