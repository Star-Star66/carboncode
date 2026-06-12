import {
  type ModelProviderConfig,
  type ReasonixConfig,
  defaultConfigPath,
  readConfig,
  writeConfig,
} from "./config.js";

export const DEFAULT_PROVIDER = "deepseek";
export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export interface ResolvedModelProvider {
  name: string;
  apiKey?: string;
  baseUrl: string;
  model?: string;
  models: string[];
}

function cleanProviderConfig(value: ModelProviderConfig | undefined): ModelProviderConfig {
  if (!value) return {};
  const models = Array.isArray(value.models)
    ? value.models.filter((model): model is string => typeof model === "string" && !!model.trim())
    : undefined;
  return {
    apiKey: value.apiKey?.trim() || undefined,
    baseUrl: value.baseUrl?.trim() || undefined,
    model: value.model?.trim() || undefined,
    models: models?.map((model) => model.trim()),
  };
}

export function activeProviderName(config: ReasonixConfig = readConfig()): string {
  return config.provider?.trim() || DEFAULT_PROVIDER;
}

export function listModelProviders(config: ReasonixConfig = readConfig()): string[] {
  const names = new Set<string>([DEFAULT_PROVIDER]);
  for (const name of Object.keys(config.providers ?? {})) {
    if (name.trim()) names.add(name.trim());
  }
  return [...names].sort((left, right) => {
    if (left === DEFAULT_PROVIDER) return -1;
    if (right === DEFAULT_PROVIDER) return 1;
    return left.localeCompare(right);
  });
}

export function resolveModelProvider(
  name: string = activeProviderName(),
  config: ReasonixConfig = readConfig(),
  env: NodeJS.ProcessEnv = process.env,
): ResolvedModelProvider | null {
  const providerName = name.trim();
  if (!providerName) return null;
  const named = cleanProviderConfig(config.providers?.[providerName]);
  if (providerName !== DEFAULT_PROVIDER && !config.providers?.[providerName]) return null;

  const legacy =
    providerName === DEFAULT_PROVIDER
      ? {
          apiKey: env.DEEPSEEK_API_KEY ?? config.apiKey,
          baseUrl: env.DEEPSEEK_BASE_URL ?? config.baseUrl,
        }
      : {};
  const model = named.model ?? named.models?.[0];
  const models = [...new Set([...(named.models ?? []), ...(model ? [model] : [])])];
  return {
    name: providerName,
    apiKey: named.apiKey ?? legacy.apiKey,
    baseUrl: named.baseUrl ?? legacy.baseUrl ?? DEFAULT_DEEPSEEK_BASE_URL,
    model,
    models,
  };
}

export function loadActiveModelProvider(
  path: string = defaultConfigPath(),
  env: NodeJS.ProcessEnv = process.env,
): ResolvedModelProvider {
  const config = readConfig(path);
  return (
    resolveModelProvider(activeProviderName(config), config, env) ??
    resolveModelProvider(DEFAULT_PROVIDER, config, env)!
  );
}

export function saveActiveProvider(name: string, path: string = defaultConfigPath()): void {
  const config = readConfig(path);
  if (!listModelProviders(config).includes(name)) {
    throw new Error(`Unknown provider: ${name}`);
  }
  config.provider = name;
  writeConfig(config, path);
}
