import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { createAdminServer } from "../admin-portal/server";
import { Brain } from "@/core";
import { Swaps } from "@/filters/swaps/manager";

const baseSettings = {
   outburstThreshold: 0,
   numberOfLines: 1,
   angerLevel: 0.1,
   surprise: 0,
   angerIncrease: 1,
   angerDecrease: 1,
   recursion: 1,
   conversationTimeLimit: 10,
   learnFromBots: false,
   secretPlaces: []
};

describe("admin portal integration", () => {
   const originalState = {
      lexicon: Brain.lexicon,
      nGrams: Brain.nGrams,
      botName: Brain.botName,
      settings: Brain.settings,
      chainLength: Brain.chainLength
   };

   let tempDir = "";
   let server: ReturnType<typeof createAdminServer> | undefined;

   beforeEach(() => {
      Brain.botName = "unit-test";
      Brain.settings = { ...baseSettings };
      Brain.chainLength = 3;
      Brain.lexicon = new Map([
         ["hello", new Set(["hello│world│again", "hello│there│friend"])],
         ["world", new Set(["hello│world│again"])]
      ]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([
         ["hello│world│again", {
            tokens: ["hello", "world", "again"],
            canStart: true,
            canEnd: false,
            nextTokens: new Map([["again", 1]]),
            previousTokens: new Map([["<EOL>", 1]])
         }],
         ["hello│there│friend", {
            tokens: ["hello", "there", "friend"],
            canStart: false,
            canEnd: true,
            nextTokens: new Map([["friend", 1]]),
            previousTokens: new Map([["hello", 1]])
         }]
      ]) as unknown as typeof Brain.nGrams;

      tempDir = mkdtempSync(join(os.tmpdir(), "admin-portal-"));
      mkdirSync(join(tempDir, "plugins"), { recursive: true });
      writeFileSync(join(tempDir, "index.html"), "<html></html>", "utf8");
      server = createAdminServer({ publicDir: tempDir, host: "127.0.0.1", quiet: true });
   });

   afterEach(async () => {
      if (server) {
         await server.stop();
      }
      if (tempDir) {
         rmSync(tempDir, { recursive: true, force: true });
      }
      Swaps.clearScope("user", "user-1");
      Brain.lexicon = originalState.lexicon;
      Brain.nGrams = originalState.nGrams;
      Brain.botName = originalState.botName;
      Brain.settings = originalState.settings;
      Brain.chainLength = originalState.chainLength;
   });

   const callApi = async (path: string, options?: { method?: string; body?: string }): Promise<{ status: number; body: string }> => {
      if (!server) throw new Error("server not initialized");
      const handler = server.server.listeners("request")[0] as (req: unknown, res: unknown) => Promise<void> | void;
      let body = "";
      const res = {
         statusCode: 200,
         writeHead: (status: number) => {
            res.statusCode = status;
         },
         end: (chunk?: string | Buffer) => {
            if (chunk) body += chunk.toString();
            resolve({ status: res.statusCode, body });
         }
      } as unknown as { statusCode: number; writeHead: (status: number) => void; end: (chunk?: string | Buffer) => void };
      const req = Object.assign(new (await import("node:events")).EventEmitter(), {
         url: path,
         method: options?.method ?? "GET",
         headers: {
            "content-type": "application/json"
         }
      }) as { url: string; method: string; headers: Record<string, string>; emit: (event: string, payload?: unknown) => boolean };
      let resolve: (value: { status: number; body: string }) => void = () => {};
      const response = new Promise<{ status: number; body: string }>((resolveResponse) => {
         resolve = resolveResponse;
      });
      const handlerPromise = Promise.resolve(handler(req, res));
      if (req.method !== "GET") {
         const payload = options?.body ?? "";
         setImmediate(() => {
            if (payload) req.emit("data", Buffer.from(payload));
            req.emit("end");
         });
      }
      const [result] = await Promise.all([response, handlerPromise]);
      return result;
   };

   it("serves core brain endpoints", async () => {
      const statsResponse = await callApi("/api/brain/stats");
      const stats = JSON.parse(statsResponse.body) as {
         lexiconCount: number;
         ngramCount: number;
      };
      expect(stats.lexiconCount).toBe(2);
      expect(stats.ngramCount).toBe(2);

      const lexiconResponse = await callApi("/api/brain/lexicon?query=he&offset=0&limit=5");
      const lexicon = JSON.parse(lexiconResponse.body) as {
         items: Array<{ word: string; ngramCount: number }>;
      };
      expect(lexicon.items[0]).toMatchObject({ word: "hello", ngramCount: 2 });

      const topResponse = await callApi("/api/brain/top?limit=1");
      const top = JSON.parse(topResponse.body) as {
         items: Array<{ token: string; count: number }>;
      };
      expect(top.items).toHaveLength(1);

      const ngramsResponse = await callApi("/api/brain/ngrams?offset=0&limit=5");
      const ngrams = JSON.parse(ngramsResponse.body) as {
         items: unknown[];
         index: { state: string };
      };
      expect(Array.isArray(ngrams.items)).toBe(true);
      expect(["idle", "building", "ready"]).toContain(ngrams.index.state);
   });

   it("updates settings and manages swap rules via the api", async () => {
      const invalidResponse = await callApi("/api/settings/brain", {
         method: "POST",
         body: JSON.stringify({ learnFromBots: "nope" })
      });
      expect(invalidResponse.status).toBe(400);

      const okResponse = await callApi("/api/settings/brain", {
         method: "POST",
         body: JSON.stringify({ learnFromBots: true })
      });
      expect(okResponse.status).toBe(200);
      expect(Brain.settings.learnFromBots).toBe(true);

      const swapResponse = await callApi("/api/swaps/rule", {
         method: "POST",
         body: JSON.stringify({
            scope: "user",
            scopeId: "user-1",
            pattern: "fudge",
            replacement: "frick",
            applyLearn: true,
            applyRespond: true
         })
      });
      expect(swapResponse.status).toBe(200);

      const listResponse = await callApi("/api/swaps/rules?scope=user&scopeId=user-1");
      const list = JSON.parse(listResponse.body) as { rules: Array<{ pattern: string; replacement: string }> };
      expect(list.rules.some(rule => rule.pattern === "fudge" && rule.replacement === "frick")).toBe(true);
   });
});
