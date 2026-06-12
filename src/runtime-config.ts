import { readFileSync } from "node:fs";
import { type ReasonixConfig, defaultConfigPath } from "./config.js";
import { DEFAULT_PROVIDER, activeProviderName, resolveModelProvider } from "./providers.js";

export interface RuntimeConnectionConfig {
  provider: string;
  apiKey?: string;
  baseUrl: string;
  model?: string;
  models: string[];
}

function readConfigStrict(path: string): ReasonixConfig | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as ReasonixConfig) : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    return null;
  }
}

/** Re-read connection settings while preserving genuine environment overrides.
 * Matching env/file values are the CLI's config bridge; distinct env values stay pinned. */
export class RuntimeConnectionConfigSource {
  private readonly apiKeyPinnedByEnv: boolean;
  private readonly baseUrlPinnedByEnv: boolean;

  constructor(
    private readonly path = defaultConfigPath(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    const initial = readConfigStrict(path) ?? {};
    this.apiKeyPinnedByEnv = Boolean(
      env.DEEPSEEK_API_KEY && env.DEEPSEEK_API_KEY !== initial.apiKey,
    );
    this.baseUrlPinnedByEnv = Boolean(
      env.DEEPSEEK_BASE_URL && env.DEEPSEEK_BASE_URL !== initial.baseUrl,
    );
  }

  read(): RuntimeConnectionConfig | null {
    const config = readConfigStrict(this.path);
    if (!config) return null;
    const providerName = activeProviderName(config);
    const provider = resolveModelProvider(providerName, config, {
      ...this.env,
      ...(this.apiKeyPinnedByEnv ? {} : { DEEPSEEK_API_KEY: undefined }),
      ...(this.baseUrlPinnedByEnv ? {} : { DEEPSEEK_BASE_URL: undefined }),
    });
    if (!provider) return null;
    return {
      provider: provider.name,
      apiKey:
        provider.name === DEFAULT_PROVIDER && this.apiKeyPinnedByEnv
          ? this.env.DEEPSEEK_API_KEY
          : provider.apiKey,
      baseUrl:
        provider.name === DEFAULT_PROVIDER && this.baseUrlPinnedByEnv
          ? (this.env.DEEPSEEK_BASE_URL ?? provider.baseUrl)
          : provider.baseUrl,
      model: provider.model,
      models: provider.models,
    };
  }
}

export function sameRuntimeConnectionConfig(
  left: RuntimeConnectionConfig,
  right: RuntimeConnectionConfig,
): boolean {
  return (
    left.provider === right.provider &&
    left.apiKey === right.apiKey &&
    left.baseUrl === right.baseUrl &&
    left.model === right.model &&
    (left.models ?? []).join("\0") === (right.models ?? []).join("\0")
  );
}
