import type { QuoteSource } from "@/plugins/modules/quotes/types";

const a0lSource: QuoteSource = {
   id: "a0l",
   name: "A0L",
   description: "Quotes from A0L",
   fileName: "a0l.txt",
   matcher: /^a0l$/ui,
   icon: "plugins/quotes/a0l.png",
   modifications: { Case: "unchanged" }
};

const sources = [a0lSource];
export { sources };
