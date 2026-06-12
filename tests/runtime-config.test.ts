import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeConfig } from "../src/config.js";
import {
  RuntimeConnectionConfigSource,
  sameRuntimeConnectionConfig,
} from "../src/runtime-config.js";

describe("runtime connection config", () => {
  const dirs: string[] = [];

  function configPath(): string {
    const dir = mkdtempSync(join(tmpdir(), "carboncode-runtime-config-"));
    dirs.push(dir);
    return join(dir, "config.json");
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("re-reads API key and base URL changes from the config file", () => {
    const path = configPath();
    writeConfig({ apiKey: "sk-old", baseUrl: "https://old.example.com" }, path);
    const source = new RuntimeConnectionConfigSource(path, {});

    expect(source.read()).toEqual({
      provider: "deepseek",
      apiKey: "sk-old",
      baseUrl: "https://old.example.com",
      model: undefined,
      models: [],
    });

    writeConfig({ apiKey: "sk-new", baseUrl: "https://new.example.com" }, path);
    expect(source.read()).toEqual({
      provider: "deepseek",
      apiKey: "sk-new",
      baseUrl: "https://new.example.com",
      model: undefined,
      models: [],
    });
  });

  it("allows reload when process.env only mirrors the initial config", () => {
    const path = configPath();
    writeConfig({ apiKey: "sk-old" }, path);
    const source = new RuntimeConnectionConfigSource(path, {
      DEEPSEEK_API_KEY: "sk-old",
    });

    writeConfig({ apiKey: "sk-new" }, path);
    expect(source.read()?.apiKey).toBe("sk-new");
  });

  it("keeps explicit environment overrides pinned", () => {
    const path = configPath();
    writeConfig({ apiKey: "sk-file", baseUrl: "https://file.example.com" }, path);
    const source = new RuntimeConnectionConfigSource(path, {
      DEEPSEEK_API_KEY: "sk-env",
      DEEPSEEK_BASE_URL: "https://env.example.com",
    });

    writeConfig({ apiKey: "sk-new", baseUrl: "https://new.example.com" }, path);
    expect(source.read()).toEqual({
      provider: "deepseek",
      apiKey: "sk-env",
      baseUrl: "https://env.example.com",
      model: undefined,
      models: [],
    });
  });

  it("ignores a partially written config until valid JSON is available", () => {
    const path = configPath();
    writeConfig({ apiKey: "sk-old" }, path);
    const source = new RuntimeConnectionConfigSource(path, {});

    writeFileSync(path, '{"apiKey":', "utf8");
    expect(source.read()).toBeNull();

    writeConfig({ apiKey: "sk-new" }, path);
    expect(source.read()?.apiKey).toBe("sk-new");
  });

  it("follows active named-provider changes", () => {
    const path = configPath();
    const providers = {
      openrouter: {
        apiKey: "sk-openrouter",
        baseUrl: "https://openrouter.example/v1",
        models: ["openai/gpt-4.1"],
      },
    };
    writeConfig({ apiKey: "sk-deepseek", providers }, path);
    const source = new RuntimeConnectionConfigSource(path, {});

    writeConfig({ provider: "openrouter", apiKey: "sk-deepseek", providers }, path);

    expect(source.read()).toEqual({
      provider: "openrouter",
      apiKey: "sk-openrouter",
      baseUrl: "https://openrouter.example/v1",
      model: "openai/gpt-4.1",
      models: ["openai/gpt-4.1"],
    });
  });

  it("compares connection snapshots", () => {
    const base = { provider: "deepseek", baseUrl: "https://api.deepseek.com", models: [] };
    expect(sameRuntimeConnectionConfig({ ...base, apiKey: "a" }, { ...base, apiKey: "a" })).toBe(
      true,
    );
    expect(sameRuntimeConnectionConfig({ ...base, apiKey: "a" }, { ...base, apiKey: "b" })).toBe(
      false,
    );
  });
});
