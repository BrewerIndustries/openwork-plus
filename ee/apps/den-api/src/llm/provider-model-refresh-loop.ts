import { appLogger } from "../observability/logger.js";
import { refreshCatalogProviders } from "./provider-model-refresh.js";

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 24 * HOUR_MS;
/** Long enough that a restart loop cannot hammer a provider's /models endpoint. */
const DEFAULT_INITIAL_DELAY_MS = 5 * 60 * 1000;
/** Providers on the daily schedule: OpenRouter publishes models continuously. */
const DEFAULT_PROVIDER_IDS = ["openrouter"] as const;

/**
 * `DEN_LLM_PROVIDER_REFRESH_HOURS` sets the interval, for operators who want it
 * more or less often. `0` turns the loop off. Anything unreadable keeps the
 * daily default rather than disabling a refresh nobody asked to remove.
 */
function refreshIntervalMs() {
  const raw = process.env.DEN_LLM_PROVIDER_REFRESH_HOURS?.trim();
  if (!raw) return DEFAULT_INTERVAL_MS;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < 0) return DEFAULT_INTERVAL_MS;
  return hours === 0 ? 0 : Math.max(HOUR_MS, hours * HOUR_MS);
}

export type ProviderModelRefreshLoopHandle = { stop(): void };

/**
 * Keeps OpenRouter providers' model lists current without anyone pressing a
 * button: the same work as POST /v1/llm-providers/:id/refresh-models, run once
 * shortly after boot (so a restart does not mean waiting a day) and then daily.
 * Only catalog providers are touched, never custom ones, whose config owns the
 * model list.
 */
export function startProviderModelRefreshLoop(options: {
  enabled?: boolean;
  intervalMs?: number;
  initialDelayMs?: number;
  providerIds?: readonly string[];
} = {}): ProviderModelRefreshLoopHandle {
  const intervalMs = options.intervalMs ?? refreshIntervalMs();
  const enabled = options.enabled ?? intervalMs > 0;
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS);
  const providerIds = options.providerIds ?? DEFAULT_PROVIDER_IDS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(() => {
      void run();
    }, delayMs);
    timer.unref?.();
  };

  const run = async () => {
    try {
      const result = await refreshCatalogProviders({ providerIds });
      if (result.refreshed > 0 || result.failed > 0) {
        appLogger.info("Scheduled provider model refresh finished", {
          component: "provider_model_refresh",
          providers: result.refreshed,
          failed: result.failed,
          models: result.models,
          provider_ids: providerIds,
        });
      }
    } catch (error) {
      appLogger.error("Scheduled provider model refresh failed", {
        component: "provider_model_refresh",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      schedule(intervalMs);
    }
  };

  if (enabled) {
    appLogger.info("Scheduled provider model refresh enabled", {
      component: "provider_model_refresh",
      interval_ms: intervalMs,
      initial_delay_ms: initialDelayMs,
      provider_ids: providerIds,
    });
    schedule(initialDelayMs);
  }

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
