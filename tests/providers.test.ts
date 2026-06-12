import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeConfig } from "../src/config.js";
import {
  activeProviderName,
  listModelProviders,
  loadActiveModelProvider,
  resolveModelProvider,
} from "../src/providers.js";

describe("model providers", () => {
  it("keeps legacy API settings as the default DeepSeek provider", () => {
    const provider = resolveModelProvider(
      "deepseek",
      { apiKey: "sk-legacy", baseUrl: "https://legacy.example.com" },
      {},
    );
    expect(provider).toEqual({
      name: "deepseek",
      apiKey: "sk-legacy",
      baseUrl: "https://legacy.example.com",
      model: undefined,
      models: [],
    });
  });

  it("resolves named OpenAI-compatible providers and their model catalog", () => {
    const config = {
      provider: "openrouter",
      providers: {
        openrouter: {
          apiKey: "sk-or-test",
          baseUrl: "https://openrouter.ai/api/v1/",
          model: "anthropic/claude-sonnet-4",
          models: ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
        },
      },
    };
    expect(activeProviderName(config)).toBe("openrouter");
    expect(listModelProviders(config)).toEqual(["deepseek", "openrouter"]);
    expect(resolveModelProvider("openrouter", config, {})).toEqual({
      name: "openrouter",
      apiKey: "sk-or-test",
      baseUrl: "https://openrouter.ai/api/v1/",
      model: "anthropic/claude-sonnet-4",
      models: ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
    });
  });

  it("loads the active provider from a config path", () => {
    const dir = mkdtempSync(join(tmpdir(), "carboncode-providers-"));
    const path = join(dir, "config.json");
    try {
      writeConfig(
        {
          provider: "siliconflow",
          providers: {
            siliconflow: {
              apiKey: "token-test",
              baseUrl: "https://api.siliconflow.cn/v1",
              model: "deepseek-ai/DeepSeek-V3",
            },
          },
        },
        path,
      );
      expect(loadActiveModelProvider(path, {}).name).toBe("siliconflow");
      expect(loadActiveModelProvider(path, {}).model).toBe("deepseek-ai/DeepSeek-V3");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null for unknown provider names", () => {
    expect(resolveModelProvider("missing", {}, {})).toBeNull();
  });
});
