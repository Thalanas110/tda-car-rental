import { afterEach, describe, expect, it } from "vitest";

const bridge = {
  documents: {
    save: async () => 1,
    get: async () => undefined,
    update: async () => undefined,
    list: async () => [],
    delete: async () => undefined,
  },
  migration: {
    scanChromium: async () => [],
    importFile: async () => ({ source: "manual", importedCount: 0, message: "" }),
  },
};

afterEach(() => {
  Reflect.deleteProperty(window, "tda");
});

describe("electronApi", () => {
  it("returns the context-isolated Electron bridge", async () => {
    Object.defineProperty(window, "tda", { configurable: true, value: bridge });
    const modulePath = "./electron-api";
    const module = await import(modulePath).catch(() => undefined);

    expect(module?.electronApi).toBeTypeOf("function");
    if (!module) return;
    expect(module.electronApi()).toBe(bridge);
  });
});
