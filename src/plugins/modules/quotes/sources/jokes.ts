import type { CoreMessage } from "@/platform";
import type { TriggerResult } from "@/core/triggerTypes";
import type { QuoteHelpers, QuoteSource } from "@/plugins/modules/quotes/types";

const API = "https://v2.jokeapi.dev/joke/Any?format=txt";
const defaultFallback = "why did the chicken cross the road? to get to the other side!";

const jokeMatcher = /tell (?<person>.+)? ?(?:a(?:nother)?) ?joke(?: about (?<topic>.+))?/ui;
const jokeCommandMatcher = /^!?joke(?:\s+(?<topic>.+))?$/ui;
const jokeFallbackMatcher = /^(?:!?joke(?:\s+.+)?$)|(?:tell .+?joke(?: about .+)?)$/ui;

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
   context: CoreMessage,
   _match: RegExpMatchArray | undefined,
   helpers: QuoteHelpers
): Promise<TriggerResult> => {
   const ambientMatch = context.content.match(jokeMatcher);
   const commandMatch = context.content.match(jokeCommandMatcher);
   const topic = (ambientMatch?.groups?.topic ?? commandMatch?.groups?.topic ?? "").trim();
   const directedRaw = (ambientMatch?.groups?.person ?? "").trim();
   const fallback = getFallbackJoke(helpers);
   let joke = await fetchJoke(topic || undefined, fallback);
   const result: TriggerResult = {
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
