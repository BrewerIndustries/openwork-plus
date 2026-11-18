import { and, eq, lt, or } from "@openwork-ee/den-db/drizzle";
import { LlmProviderModelTable, LlmProviderTable } from "@openwork-ee/den-db/schema";
import { createDenTypeId } from "@openwork-ee/utils/typeid";
import { db } from "../db.js";
import { appLogger } from "../observability/logger.js";
import { discoverCustomProviderModels } from "./custom-provider-discovery.js";
import { getModelsDevProvider, type ModelsDevModel, type ModelsDevProvider } from "./models-dev.js";
import { decodeProviderCredential } from "./provider-credentials.js";

/**
 * Every model a catalog provider offers: its models.dev entries, plus any model
 * the provider's own `/models` already lists that the catalog has not caught up
 * with. Used when a write omits `modelIds`, which means "all models", and by the
 * refresh path. A provider-list failure never blocks the caller: the catalog is
 * the fallback, so an unreachable provider still stores its key.
 */
export async function allCatalogProviderModels(provider: ModelsDevProvider, apiKey: string | undefined) {
  const models: ModelsDevModel[] = [...provider.models];
  const known = new Set(models.map((model) => model.id));
  const baseUrl = provider.api?.trim();
  const key = apiKey?.trim();
  if (!baseUrl || !key) return models;
  const discovered = await discoverCustomProviderModels(
    { baseUrl, apiKey: key },
    { loadMatchCatalog: async () => provider.models },
  ).catch(() => null);
  for (const found of discovered?.models ?? []) {
    if (known.has(found.id)) continue;
    known.add(found.id);
    // A model the catalog does not know and the provider described only
    // briefly still belongs in "all models": keep it with what we have.
    const name = found.model?.name ?? found.id;
    models.push({
      id: found.id,
      name,
      config: found.model ? { ...found.model } : { id: found.id, name },
    });
  }
  return models;
}

/**
 * Replaces a catalog provider's stored models with its current list and returns
 * how many it now has. Shared by the on-demand refresh route and the scheduled
 * refresh so both write exactly the same set.
 */
export async function refreshCatalogProviderModels(input: {
  providerRow: Pick<typeof LlmProviderTable.$inferSelect, "id" | "apiKey">;
  provider: ModelsDevProvider;
}): Promise<number> {
  const credential = decodeProviderCredential(input.providerRow.apiKey);
  const models = await allCatalogProviderModels(
    input.provider,
    credential.apiKey ?? Object.values(credential.apiKeys ?? {})[0],
  );
  const providerRowId = input.providerRow.id;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(LlmProviderModelTable).where(eq(LlmProviderModelTable.llmProviderId, providerRowId));
    if (models.length > 0) {
      await tx.insert(LlmProviderModelTable).values(models.map((model) => ({
        id: createDenTypeId("llmProviderModel"),
        llmProviderId: providerRowId,
        modelId: model.id,
        name: model.name,
        modelConfig: model.config,
        createdAt: now,
      })));
    }
    await tx.update(LlmProviderTable).set({ updatedAt: now }).where(eq(LlmProviderTable.id, providerRowId));
  });
  return models.length;
}

/**
 * Providers whose model list can be refreshed, oldest first. Only catalog
 * providers carry a provider id the catalog can resolve; custom providers own
 * their model list in their config.
 */
export async function refreshableCatalogProviders(input: {
  providerIds?: readonly string[];
  staleBefore?: Date | null;
} = {}): Promise<Array<typeof LlmProviderTable.$inferSelect>> {
  const conditions = [eq(LlmProviderTable.source, "models_dev")];
  if (input.providerIds?.length) {
    const matches = input.providerIds.map((providerId) => eq(LlmProviderTable.providerId, providerId));
    const combined = matches.length === 1 ? matches[0] : or(...matches);
    if (combined) conditions.push(combined);
  }
  if (input.staleBefore) {
    conditions.push(lt(LlmProviderTable.updatedAt, input.staleBefore));
  }
  return db.select().from(LlmProviderTable).where(and(...conditions));
}

/**
 * Refresh every matching provider, logging one line per provider. A failure on
 * one provider never stops the others. Returns the counts for callers that
 * report them.
 */
export async function refreshCatalogProviders(input: {
  providerIds?: readonly string[];
  staleBefore?: Date | null;
} = {}): Promise<{ refreshed: number; failed: number; models: number }> {
  const rows = await refreshableCatalogProviders(input);
  let refreshed = 0;
  let failed = 0;
  let models = 0;
  for (const row of rows) {
    try {
      const provider = await getModelsDevProvider(row.providerId ?? "");
      if (!provider) throw new Error("Provider is no longer in the models.dev catalog");
      const count = await refreshCatalogProviderModels({
        providerRow: row,
        provider,
      });
      models += count;
      refreshed += 1;
      appLogger.info("Provider models refreshed", {
        component: "provider_model_refresh",
        llm_provider_id: row.id,
        provider_id: row.providerId,
        models: count,
      });
    } catch (error) {
      failed += 1;
      appLogger.warn("Provider model refresh failed", {
        component: "provider_model_refresh",
        llm_provider_id: row.id,
        provider_id: row.providerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { refreshed, failed, models };
}
