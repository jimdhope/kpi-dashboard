"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ACT_THEMES } from "./themes";
import { ThemeContext } from "./theme-context";
import { SLIDES } from "./slides";

const StageCanvas = dynamic(() => import("../three/stage-canvas"), {
  ssr: false,
});

const slideVariants: Variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? 110 : -110,
    opacity: 0,
    filter: "blur(8px)",
  }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({
    x: dir >= 0 ? -110 : 110,
    opacity: 0,
    filter: "blur(8px)",
  }),
};

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    void document.exitFullscreen?.().catch(() => {});
  }
}

export function AugFeaturesDeck() {
  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const reducedMotion = useReducedMotion();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const total = SLIDES.length;
  const slide = SLIDES[index];
  const theme = ACT_THEMES[slide.act];

  const goTo = useCallback(
    (target: number) => {
      setState(([current]) => {
        const clamped = Math.max(0, Math.min(total - 1, target));
        if (clamped === current) return [current, 0];
        return [clamped, clamped > current ? 1 : -1];
      });
    },
    [total],
  );

  const next = useCallback(() => {
    setState(([i]) => {
      const n = Math.min(total - 1, i + 1);
      return n === i ? [i, 0] : [n, 1];
    });
  }, [total]);

  const prev = useCallback(() => {
    setState(([i]) => {
      const p = Math.max(0, i - 1);
      return p === i ? [i, 0] : [p, -1];
    });
  }, [total]);

  useEffect(() => {
    const raw = window.location.hash.replace("#", "");
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= total) {
      setState([parsed - 1, 0]);
    }
  }, [total]);

  useEffect(() => {
    window.history.replaceState(null, "", `#${index + 1}`);
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
        case "PageDown":
          event.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          prev();
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(total - 1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, total]);

  const scene = useMemo(
    () => ({
      particleColor: theme.scene.particleColor,
      trophy: theme.scene.trophy,
      sparkleColor: theme.scene.sparkleColor,
    }),
    [theme],
  );

  const ActiveSlide = slide.Component;

  return (
    <ThemeContext.Provider value={theme}>
      <div
        className="fixed inset-0 select-none overflow-hidden bg-black text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.85),0_1px_4px_rgba(0,0,0,0.55)]"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStart.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0) next();
            else prev();
          }
        }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={theme.id}
            className="absolute inset-0 z-0"
            style={{ background: theme.gradient }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          />
        </AnimatePresence>

        {!reducedMotion ? <StageCanvas scene={scene} /> : null}

        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            background:
              "radial-gradient(ellipse 64% 72% at 50% 46%, rgba(2,6,23,0.5) 0%, rgba(2,6,23,0.22) 58%, transparent 80%)",
          }}
        />

        <main className="absolute inset-0 z-10">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              variants={reducedMotion ? undefined : slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <ActiveSlide />
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-white/5">
          <motion.div
            className="h-full origin-left"
            style={{
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
            }}
            animate={{ scaleX: (index + 1) / total }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        <button
          type="button"
          aria-label="Previous slide"
          onClick={prev}
          className="group absolute inset-y-0 left-0 z-20 w-[9vw] cursor-pointer"
        >
          <span className="absolute inset-y-0 left-4 flex items-center text-2xl text-white/0 transition group-hover:text-white/30">
            ‹
          </span>
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={next}
          className="group absolute inset-y-0 right-0 z-20 w-[9vw] cursor-pointer"
        >
          <span className="absolute inset-y-0 right-4 flex items-center text-2xl text-white/0 transition group-hover:text-white/30">
            ›
          </span>
        </button>

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-5 md:p-7">
          <div className="hidden w-40 text-[11px] font-bold uppercase tracking-[0.3em] text-white/55 sm:block">
            {theme.label}
          </div>
          <div className="flex items-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className="group py-2"
              >
                <span
                  className="block h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? 26 : 8,
                    background:
                      i === index ? theme.accent : "rgba(255,255,255,0.25)",
                  }}
                />
              </button>
            ))}
          </div>
          <div className="flex w-40 items-center justify-end gap-3">
            <span className="text-sm tabular-nums text-white/65">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
              disabled={index === 0}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
              disabled={index === total - 1}
            >
              ›
            </button>
            <button
              type="button"
              aria-label="Toggle fullscreen"
              onClick={toggleFullscreen}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/10"
            >
              ⛶
            </button>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
