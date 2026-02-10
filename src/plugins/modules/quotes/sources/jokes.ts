import type { StandardMessage } from "@/contracts";
import type { InteractionResult } from "@/core/interactionTypes";
import { log } from "@/core/log";
import { envFlag } from "@/utils";
import type { QuoteHelpers, QuoteSource } from "@/plugins/modules/quotes/types";

const API = "https://v2.jokeapi.dev/joke/Any?format=txt";
const defaultFallback = "why did the chicken cross the road? to get to the other side!";

const jokeMatcher = /tell (?<person>.+)? ?(?:a(?:nother)?) ?joke(?: about (?<topic>.+))?/ui;
const jokeCommandMatcher = /^!?joke(?:\s+(?<topic>.+))?$/ui;
const jokeFallbackMatcher = /^(?:!?joke(?:\s+.+)?$)|(?:tell .+?joke(?: about .+)?)$/ui;
const TRACE_FLOW = envFlag("TRACE_FLOW");
const DEBUG_JOKE = envFlag("DEBUG") || envFlag("DISCORD_DEBUG");

const getFallbackJoke = (helpers: QuoteHelpers): string => {
   const jokes = helpers.getQuotes("jokes.txt");
   if (!jokes || jokes.length === 0) return defaultFallback;
   return helpers.randomQuote(jokes);
};

const fetchJoke = async (topic: string | undefined, fallback: string): Promise<string> => {
   try {
      const response = await fetch(`${API}${topic ? `&contains=${encodeURIComponent(topic)}` : ""}`);
      if (!response.ok) return fallback;
      const joke = (await response.text()).replace("\n", "");
      if (/^Error 106/i.test(joke)) {
         return topic ? `dunno any jokes about ${topic}, but here's one better: ${fallback}` : fallback;
      }
      return joke;
   } catch {
      return fallback;
   }
};

const resolveJoke = async (
   context: StandardMessage,
   _match: RegExpMatchArray | undefined,
   helpers: QuoteHelpers
): Promise<InteractionResult> => {
   const ambientMatch = context.content.match(jokeMatcher);
   const commandMatch = context.content.match(jokeCommandMatcher);
   const topic = (ambientMatch?.groups?.topic ?? commandMatch?.groups?.topic ?? "").trim();
   if (context.id.startsWith("command:") && (DEBUG_JOKE || TRACE_FLOW)) {
      log(
         `Joke command debug: content="${context.content}" topic="${topic || ""}"`,
         TRACE_FLOW ? "trace" : "debug"
      );
   }
   const directedRaw = (ambientMatch?.groups?.person ?? "").trim();
   const fallback = getFallbackJoke(helpers);
   let joke = await fetchJoke(topic || undefined, fallback);
   const result: InteractionResult = {
      results: [{ contents: joke }],
      modifications: { ProcessSwaps: true }
   };

   if (directedRaw) {
      if (/yourself/iu.test(directedRaw)) {
         joke = `*${joke.trim()}*`;
         result.results = [{ contents: joke }];
      } else if (/me/iu.test(directedRaw)) {
         result.directedTo = context.authorName;
      } else {
         result.directedTo = directedRaw;
      }
   }

   return result;
};

const jokeSource: QuoteSource = {
   id: "joke",
   name: "Joke",
   description: "Tell a random joke (optionally about a topic). Also responds to 'tell <person> a joke [about topic]'.",
   matcher: jokeMatcher,
   icon: "plugins/quotes/joke.png",
   command: {
      name: "joke",
      description: "Tell a random joke (optionally about a topic). Also responds to 'tell <person> a joke [about topic]'.",
      options: [
         {
            name: "topic",
            description: "Topic to include in the joke",
            type: "string",
            required: false
         }
      ],
      usage: "joke [topic]",
      example: "joke cats (or: tell me a joke about cats)",
      fallbackMatcher: jokeFallbackMatcher,
      icon: "plugins/quotes/joke.png"
   },
   resolveQuote: resolveJoke
};

const sources = [jokeSource];
export { sources };
