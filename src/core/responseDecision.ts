import type { BrainSettings } from "./botSettings";
import { clamp, escapeRegExp, newRX } from "@/utils";

interface ShouldRespondInput {
   botName: string;
   text: string;
   settings: BrainSettings;
   isDirectMessage: boolean;
   isGroupDm: boolean;
   memberCount?: number;
   mentionsBot?: boolean;
   repliedToBot?: boolean;
   referencedText?: string;
   referencedMentionsBot?: boolean;
   ambientBotNameTrigger?: boolean;
}

const shouldYell = (text: string, settings: BrainSettings, rng: () => number = Math.random): boolean => {
   let newAngerLevel = settings.angerLevel;
   newAngerLevel *= (text === text.toUpperCase()) ? settings.angerIncrease : settings.angerDecrease;
   settings.angerLevel = clamp(newAngerLevel, 0.01, 10);
   return rng() < settings.angerLevel;
};

const matchesBotName = (botName: string, text: string | undefined): boolean => {
   if (!botName || !text) return false;
   return Boolean(text.match(newRX(escapeRegExp(botName), "giu")));
};

const shouldRespond = (
   input: ShouldRespondInput,
   rng: () => number = Math.random
): boolean => {
   if (input.isDirectMessage && !input.isGroupDm) return true;
   if (input.repliedToBot || input.mentionsBot || input.referencedMentionsBot) return true;

   if (input.ambientBotNameTrigger) {
      if (matchesBotName(input.botName, input.text)) return true;
      if (matchesBotName(input.botName, input.referencedText)) return true;
   }

   const baseOutburstThreshold = clamp(Number(input.settings.outburstThreshold), 0, 1);
   const outburstThreshold = input.isDirectMessage && input.isGroupDm
      ? Math.min(1, baseOutburstThreshold * Math.max(2, input.memberCount ?? 2))
      : baseOutburstThreshold;

   return rng() < outburstThreshold;
};

export type { ShouldRespondInput };
export { shouldRespond, shouldYell };
