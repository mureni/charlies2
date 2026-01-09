import { SQLiteMap } from "./SQLiteCollections";
import { checkFilePath, env } from "../utils";

const BOT_NAME = (env("BOT_NAME") ?? "").trim() || "chatbot";

export type BrainOverlayScope = "global" | "community" | "conversation";

export type BrainOverlayContext = {
   scope: BrainOverlayScope;
   id?: string;
};

export type BrainOverlay = {
   context: BrainOverlayContext;
   weights: Map<string, number>;
   updatedAt: string;
};

const overlayKey = (context: BrainOverlayContext): string => {
   if (context.scope === "global") return "global";
   if (!context.id) return `${context.scope}:unknown`;
   return `${context.scope}:${context.id}`;
};

class BrainOverlays {
   private static overlays = new SQLiteMap<string, BrainOverlay>({
      filename: checkFilePath("data", `${BOT_NAME}-brain-overlays.sqlite`),
      table: "overlays",
      cacheSize: 32,
      allowSchemaMigration: env("NODE_ENV") !== "production",
      debug: /^(1|true|yes|on)$/i.test(env("TRACE_SQL") ?? "")
   });

   public static listContexts(): BrainOverlayContext[] {
      const contexts: BrainOverlayContext[] = [];
      for (const overlay of BrainOverlays.overlays.values()) {
         contexts.push(overlay.context);
      }
      return contexts;
   }

   public static getOverlay(context: BrainOverlayContext): BrainOverlay | undefined {
      return BrainOverlays.overlays.get(overlayKey(context));
   }

   public static setOverlay(context: BrainOverlayContext, weights: Map<string, number>): void {
      BrainOverlays.overlays.set(overlayKey(context), {
         context,
         weights,
         updatedAt: new Date().toISOString()
      });
   }
}

export { BrainOverlays };
