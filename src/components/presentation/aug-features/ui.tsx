"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { animate, motion, type Variants } from "framer-motion";
import { useSlideTheme } from "./theme-context";

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export function SlideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-[6vw] pb-24 pt-16">
      {children}
    </div>
  );
}

export function GlassCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/15 bg-slate-950/55 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const theme = useSlideTheme();
  const tone = color ?? theme.accent;
  return (
    <motion.div variants={rise} className="mb-5 flex items-center gap-3">
      <span className="h-[2px] w-10 rounded-full" style={{ background: tone }} />
      <span
        className="text-xs font-bold uppercase tracking-[0.35em]"
        style={{ color: tone }}
      >
        {children}
      </span>
    </motion.div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <motion.span
      variants={rise}
      className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-md"
      style={{
        borderColor: tone ? `${tone}66` : "rgba(255,255,255,0.18)",
        background: tone ? `${tone}1f` : "rgba(2,6,23,0.55)",
        color: tone ?? "rgba(255,255,255,0.9)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </motion.span>
  );
}

export function GradientText({
  children,
  from,
  to,
}: {
  children: ReactNode;
  from: string;
  to: string;
}) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(100deg, ${from}, ${to})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        textShadow: "none",
        filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.65))",
      }}
    >
      {children}
    </span>
  );
}

export function CountUp({
  to,
  decimals = 0,
  suffix = "",
  duration = 1.8,
  delay = 0.5,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  delay?: number;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [to, duration, delay]);
  const formatted =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString("en-GB");
  return (
    <span className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

export function RatioGauge({
  value,
  size = 250,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const theme = useSlideTheme();
  const stroke = 13;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="rgba(2,6,23,0.72)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={theme.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.9, delay: 0.6, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 6px ${theme.accent}55)` }}
        />
      </svg>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
        <div
          className="font-black leading-none"
          style={{ color: theme.accent, fontSize: Math.round(size * 0.185) }}
        >
          <CountUp to={value} decimals={1} suffix="%" duration={1.9} delay={0.6} />
        </div>
        {label ? (
          <div
            className="mt-1 max-w-[72%] text-center text-[11px] font-semibold uppercase leading-snug tracking-[0.25em] text-white/75"
            style={{ fontSize: Math.max(9, Math.round(size * 0.062)) }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BetaBadge() {
  return (
    <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
      Beta
    </span>
  );
}

export type LeagueRow = {
  pos: number;
  name: string;
  pld: number;
  pts: number;
  form: number[];
};

function FormChip({ value }: { value: number }) {
  return (
    <span
      className={`grid h-5 w-5 place-items-center rounded-[5px] text-[10px] font-bold ${
        value === 1 ? "bg-amber-400/80 text-black" : "bg-white/10 text-white/70"
      }`}
    >
      {value}
    </span>
  );
}

export function LeagueTableMini({ rows }: { rows: LeagueRow[] }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="w-full overflow-hidden rounded-2xl border border-white/15 bg-slate-950/60 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"
    >
      <div className="grid grid-cols-[2.2rem_1fr_2.6rem_3.2rem_7.25rem] items-center gap-2 border-b border-white/10 px-4 py-2.5 text-[10px] font-bold uppercase text-white/60">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Pld</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Form</span>
      </div>
      {rows.map((row, i) => {
        const promo = i < 2;
        const releg = i >= rows.length - 2;
        const zone = promo
          ? { stripe: "#34d399", bg: "rgba(52,211,153,0.10)" }
          : releg
            ? { stripe: "#fb7185", bg: "rgba(251,113,133,0.10)" }
            : { stripe: "transparent", bg: "rgba(255,255,255,0.03)" };
        return (
          <motion.div
            key={row.pos}
            variants={rise}
            className="grid grid-cols-[2.2rem_1fr_2.6rem_3.2rem_7.25rem] items-center gap-2 px-4 py-2.5"
            style={{
              background: zone.bg,
              boxShadow: `inset 4px 0 0 0 ${zone.stripe}`,
            }}
          >
            <span className="text-sm font-black text-white/80">{row.pos}</span>
            <span className="truncate text-sm font-semibold">{row.name}</span>
            <span className="text-right text-sm tabular-nums text-white/60">
              {row.pld}
            </span>
            <span className="text-right text-sm font-bold tabular-nums">
              {row.pts.toLocaleString("en-GB")}
            </span>
            <span className="flex justify-end gap-1">
              {row.form.map((f, j) => (
                <FormChip key={j} value={f} />
              ))}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
