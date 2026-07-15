const metricsState = globalThis as typeof globalThis & {
  __kpiQuestMetricsTimer?: NodeJS.Timeout;
};

export function registerNodeInstrumentation() {
  console.info(JSON.stringify({
    event: "application_start",
    nodeVersion: process.version,
    nextRuntime: process.env.NEXT_RUNTIME,
    environment: process.env.NODE_ENV,
    release: process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown",
  }));

  if (process.env.ENABLE_RUNTIME_METRICS !== "true" || metricsState.__kpiQuestMetricsTimer) return;

  const intervalMs = Math.max(15_000, Number(process.env.RUNTIME_METRICS_INTERVAL_MS) || 60_000);
  metricsState.__kpiQuestMetricsTimer = setInterval(() => {
    const memory = process.memoryUsage();
    console.info(JSON.stringify({
      event: "runtime_memory",
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
      uptimeSeconds: Math.round(process.uptime()),
    }));
  }, intervalMs);
  metricsState.__kpiQuestMetricsTimer.unref();
}
