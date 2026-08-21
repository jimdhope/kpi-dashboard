"use client";

import { motion } from "framer-motion";
import { Chip, Kicker, SlideLayout, rise, stagger } from "../ui";

const NODES = [
  { date: "Mar 31", label: "Reshuffle" },
  { date: "Jun 30", label: "Reshuffle" },
  { date: "Sep 30", label: "Reshuffle" },
  { date: "Dec 31", label: "Season ends" },
];

export function S09NextYear() {
  return (
    <SlideLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl"
      >
        <Kicker>And from 2027…</Kicker>
        <motion.h1
          variants={rise}
          className="text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-tight tracking-tight"
        >
          A full season structure
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-4 max-w-2xl text-lg text-white/65 md:text-xl"
        >
          Monthly titles all year — and they&apos;re your ticket to the big one.
        </motion.p>

        <motion.div variants={rise} className="mt-14">
          <div className="relative">
            <motion.div
              className="absolute left-0 right-0 top-5 h-[3px] origin-left rounded-full bg-gradient-to-r from-emerald-400 to-amber-300"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.9, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="grid grid-cols-4 gap-4">
              {NODES.map((node, i) => (
                <motion.div
                  key={node.date}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 + i * 0.28, duration: 0.55 }}
                  className="flex flex-col items-center text-center"
                >
                  <span className="z-10 h-10 w-10 rounded-full border-2 border-emerald-400 bg-[#062312] shadow-[0_0_16px_rgba(74,222,128,0.35)]" />
                  <span className="mt-3 text-base font-black">{node.date}</span>
                  <span className="mt-1 text-xs uppercase tracking-wider text-white/65">
                    {node.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={rise}
          className="mt-14 rounded-3xl border border-amber-300/40 bg-slate-950/55 p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200">
            December Finals Week
          </p>
          <p className="mt-3 text-xl font-bold md:text-2xl">
            Division winners go head-to-head for the crown of{" "}
            <span className="text-amber-300">Annual Champion</span>.
          </p>
        </motion.div>

        <motion.div variants={rise} className="mt-6 flex justify-center">
          <Chip tone="#fbbf24">Monthly titles = finals qualification</Chip>
        </motion.div>
      </motion.div>
    </SlideLayout>
  );
}
