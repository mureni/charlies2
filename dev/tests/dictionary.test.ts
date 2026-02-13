import { beforeEach, describe, expect, it, vi } from "vitest";

let files = new Map<string, string>();

const existsSync = vi.fn((path: string) => files.has(path));
const readFileSync = vi.fn((path: string) => {
   const value = files.get(path);
   if (value === undefined) {
      throw new Error(`missing file: ${path}`);
   }
   return value;
});
const writeFileSync = vi.fn((path: string, contents: string) => {
   files.set(path, contents);
});

vi.mock("fs", () => ({
   existsSync,
   readFileSync,
   writeFileSync
}));

vi.mock("@/utils", () => ({
   checkFilePath: (scope: string, file: string) => `${scope}/${file}`
}));

beforeEach(() => {
   files = new Map<string, string>();
   existsSync.mockClear();
   readFileSync.mockClear();
   writeFileSync.mockClear();
   vi.resetModules();
});

describe("dictionary", () => {
   it("loads dictionary words from data when available", async () => {
      files.set("data/dictionary.txt", "Alpha\nBeta\n");
      const { loadDictionary, isCommonWord } = await import("@/core/dictionary");
      const dictionary = loadDictionary();
      expect(dictionary.has("alpha")).toBe(true);
      expect(dictionary.has("beta")).toBe(true);
      expect(isCommonWord("Alpha")).toBe(true);
      expect(readFileSync).toHaveBeenCalledTimes(1);

      const second = loadDictionary();
      expect(second).toBe(dictionary);
      expect(readFileSync).toHaveBeenCalledTimes(1);
   });

   it("falls back to resource dictionary when data file is missing", async () => {
      files.set("resources/dictionary.txt", "Gamma\nDelta\n");
      const { loadDictionary, isCommonWord } = await import("@/core/dictionary");
      const dictionary = loadDictionary();
      expect(dictionary.has("gamma")).toBe(true);
      expect(dictionary.has("delta")).toBe(true);
      expect(isCommonWord("Delta")).toBe(true);
   });

   it("builds dictionary from trainer data when no lists exist", async () => {
      files.set("resources/default-trainer.txt", "Hello world\nWorld's end");
      const { loadDictionary, isCommonWord } = await import("@/core/dictionary");
      const dictionary = loadDictionary();
      expect(dictionary.has("hello")).toBe(true);
      expect(dictionary.has("world")).toBe(true);
      expect(dictionary.has("world's")).toBe(true);
      expect(isCommonWord("world")).toBe(true);
      expect(writeFileSync).toHaveBeenCalledWith(
         "data/dictionary.txt",
         expect.stringContaining("hello"),
         "utf8"
      );
   });

   it("returns an empty dictionary when no sources exist", async () => {
      const { loadDictionary, isCommonWord } = await import("@/core/dictionary");
      const dictionary = loadDictionary();
      expect(dictionary.size).toBe(0);
      expect(isCommonWord("any")).toBe(false);
   });
});
