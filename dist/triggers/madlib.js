"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const controllers_1 = require("../controllers");
const madlib = {
    id: "madlib",
    name: "Madlib generator",
    description: "Generates a paragraph of bullshit",
    usage: "madlib",
    command: /^madlib$/ui,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.ProcessSwaps, directedTo: undefined };
        const size = 2 + Math.floor(Math.random() * 3);
        output.results = [controllers_1.Madlibs.generate(size)];
        return output;
    }
};
const madlibAddWord = {
    id: "madlib-add-word",
    name: "Add madlib word",
    description: "Adds a word of <type> to the madlib generator; if <type> does not exist, it will create the new vocabulary type and add the word",
    usage: "madlib-add-word <type> <word>",
    command: /^madlib-add-word (?<type>.+?) (?<word>.+)$/ui,
    action: (_context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const vocabType = `[${core_1.cleanMessage((matches.groups.type || "").trim(), core_1.Modifications.ForceLowercase & core_1.Modifications.FriendlyNames)}]`;
        const word = core_1.cleanMessage((matches.groups.word || "").trim(), core_1.Modifications.ForceLowercase & core_1.Modifications.FriendlyNames);
        const success = controllers_1.Madlibs.addVocab(vocabType, word);
        output.results = [success ? `added \`${word}\` to vocabulary list for \`${vocabType}\`` : `can't do that, try again`];
        return output;
    }
};
const madlibRemoveWord = {
    id: "madlib-remove-word",
    name: "Remove madlib word",
    description: "Removes a word of <type> from the madlib generator",
    usage: "madlib-remove-word <type> <word>",
    command: /^madlib-remove-word (?<type>.+?) (?<word>.+)$/ui,
    action: (_context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const vocabType = `[${core_1.cleanMessage((matches.groups.type || "").trim(), core_1.Modifications.ForceLowercase & core_1.Modifications.FriendlyNames)}]`;
        const word = core_1.cleanMessage((matches.groups.word || "").trim(), core_1.Modifications.ForceLowercase & core_1.Modifications.FriendlyNames);
        const success = controllers_1.Madlibs.removeVocab(vocabType, word);
        output.results = [success ? `removed \`${word}\` from vocabulary list for \`${vocabType}\`` : `can't do that, try again`];
        return output;
    }
};
const madlibAddPattern = {
    id: "madlib-add-pattern",
    name: "Add madlib pattern",
    description: "Adds a pattern to the madlib generator -- Pattern consists of static words mixed with vocabulary types enclosed in square brackets (i.e. \`[noun]\` or other defined types); unknown vocabulary types will be ignored",
    usage: "madlib-add-pattern <pattern> (Example: madlib-add-pattern the [adverb] [noun] [verb]ed [preposition] the [noun].)",
    command: /^madlib-add-pattern (?<pattern>.+)$/ui,
    action: (_context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const pattern = core_1.cleanMessage((matches.groups.pattern || "").trim(), core_1.Modifications.ForceLowercase & core_1.Modifications.FriendlyNames);
        const success = controllers_1.Madlibs.addPattern(pattern);
        output.results = [success ? `added \`${pattern}\` to pattern list` : `can't do that, try again`];
        return output;
    }
};
const madlibRemovePattern = {
    id: "madlib-remove-pattern",
    name: "Remove madlib pattern",
    description: "Removes a pattern from the madlib generator, if it exists",
    usage: "madlib-remove-pattern <pattern>",
    command: /^madlib-remove-pattern (?<pattern>.+)$/ui,
    action: (_context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const pattern = core_1.cleanMessage((matches.groups.pattern || "").trim(), core_1.Modifications.ForceLowercase & core_1.Modifications.FriendlyNames);
        const success = controllers_1.Madlibs.removePattern(pattern);
        output.results = [success ? `removed \`${pattern}\` from pattern list` : `can't do that, try again`];
        return output;
    }
};
const triggers = [madlib, madlibAddWord, madlibRemoveWord, madlibAddPattern, madlibRemovePattern];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFkbGliLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL21hZGxpYi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrQ0FBdUY7QUFDdkYsZ0RBQXlDO0FBRXpDLE1BQU0sTUFBTSxHQUFZO0lBQ3JCLEVBQUUsRUFBRSxRQUFRO0lBQ1osSUFBSSxFQUFFLGtCQUFrQjtJQUN4QixXQUFXLEVBQUUsbUNBQW1DO0lBQ2hELEtBQUssRUFBRSxRQUFRO0lBQ2YsT0FBTyxFQUFFLFlBQVk7SUFDckIsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNWLE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUNoSCxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDL0MsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLHFCQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDMUMsT0FBTyxNQUFNLENBQUM7SUFDakIsQ0FBQztDQUNILENBQUE7QUFFRCxNQUFNLGFBQWEsR0FBWTtJQUM1QixFQUFFLEVBQUUsaUJBQWlCO0lBQ3JCLElBQUksRUFBRSxpQkFBaUI7SUFDdkIsV0FBVyxFQUFFLGtJQUFrSTtJQUMvSSxLQUFLLEVBQUUsK0JBQStCO0lBQ3RDLE9BQU8sRUFBRSw4Q0FBOEM7SUFDdkQsTUFBTSxFQUFFLENBQUMsUUFBaUIsRUFBRSxVQUE0QixFQUFFLEVBQUUsRUFBRTtRQUMzRCxNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDeEcs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