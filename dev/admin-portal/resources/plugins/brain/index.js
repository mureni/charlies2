import { template, getBrainRefs } from "./template.js";
import { createStatsModule } from "./stats.js";
import { createLexiconModule } from "./lexicon.js";
import { createNgramModule } from "./ngram.js";

export async function render(container, context) {
   const { api } = context;
   container.innerHTML = template;

   const refs = getBrainRefs(container);

   const state = {
      lexicon: {
         query: "",
         offset: 0,
         limit: 50,
         total: 0,
         items: [],
         loading: false
      },
      word: {
         word: "",
         limit: 12,
         loading: false,
         total: 0
      },
      ngram: {
         items: [],
         windowOffset: 0,
         windowSize: 1200,
         chunkSize: 200,
         total: 0,
         loading: false,
         sortKey: "",
         sortDir: "asc",
         currentHash: "",
         currentTokens: [],
         filters: {
            contains: "",
            notContains: "",
            canStart: "any",
            canEnd: "any",
            nextMin: "",
            nextMax: "",
            prevMin: "",
            prevMax: "",
            tokenMin: "",
            tokenMax: ""
         },
         index: {
            state: "idle",
            scanned: 0,
            total: 0,
            builtAt: null,
            stale: false
         },
         pollTimer: null
      },
      top: {
         limit: 20
      }
   };

   const ngramModule = createNgramModule({ api, refs, state });
   const lexiconModule = createLexiconModule({ api, refs, state, onSelectHash: ngramModule.loadHashDetail });
   const statsModule = createStatsModule({ api, refs, state });

   lexiconModule.bindLexiconEvents();
   ngramModule.bindNgramEvents();
   statsModule.bindStatsEvents();

   await statsModule.loadStats();
   await lexiconModule.loadLexicon({ reset: true });
   await ngramModule.loadNgramTable({ reset: true });
   await statsModule.loadTopTokens();
}
