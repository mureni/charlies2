import { GuildMemberManager, User } from "discord.js";

interface Conversation {   
   lastSpokeAt: number;
   lastTopic: string;
}

interface KnownUser {
   name: string;
   aliases: Set<string>;
   conversations: Map<string, Conversation>;
}

const memoizedRX: Map<string, RegExp> = new Map<string, RegExp>();

const newRX = (expr: string, flags?: string) => {
   if (!memoizedRX.has(expr)) {
      const rx = flags ? new RegExp(expr, flags) : new RegExp(expr);
      memoizedRX.set(expr, rx);
      return rx;
   } else {
      return memoizedRX.get(expr) as RegExp;
   }   
}

const KnownUsers: Map<string, KnownUser> = new Map<string, KnownUser>();

const getEndearment = (plural: boolean = false): string => {
   const synonyms = ["pal", plural ? "buddie" : "buddy", "chum", "compadre", "comrade", "friend", "my friend", "mate", "amigo", "fella", "bro", "broseph", "darling", "sweetheart", "sweetpea", plural ? "honie" : "honey", "sweetie"];
   const endearment = synonyms[Math.floor(Math.random() * synonyms.length)];
   return `${endearment}${plural ? "s" : ""}`;
}

const getDisplayName = (member: User, memberManager?: GuildMemberManager) => {
   let displayName: string = "";
   
   displayName = member.username;
   if (memberManager) displayName = memberManager.resolve(member)?.displayName ?? member.username;
   
   if (displayName === "") displayName = "<UNKNOWN USER>";

   return displayName;
}

const escapeRegExp = (rx: string) => {
   return rx.replace(/[.*+?^${}()|[\]\\]/ug, '\\$&');
};
// TODO: Change user interpolation from getting discord info to internal KnownUsers

const interpolateUsers = (text: string, members: GuildMemberManager | undefined = undefined, overrideNames: boolean = false): string => {   
   
   /* Swap @roles, @everyone, @here references with plural endearment */
   text = text.replace(/<@&\d+>/uig, getEndearment(true));
   text = text.replace(/@everyone|@here|@room/uig, getEndearment(true));
   
   /* Replace raw @!UserID messages based on internal database of known users (whether they are still active or not) */
   // TODO: Save KnownUsers between program runs
   for (let id of KnownUsers.keys()) {
      const displayName = KnownUsers.get(id)?.name ?? getEndearment();
      /* Replace all known aliases for each user with the user's known name */
      // TODO: Do not replace words that are also in the lexicon as actual words 
      for (let alias of KnownUsers.get(id)?.aliases.values() ?? []) {         
         text = text.replace(newRX(`\b${escapeRegExp(alias)}\b`, "uig"), displayName);
      }
      text = text.replace(newRX(`<@!?\s*${escapeRegExp(id)}>`, "uig"), displayName);
      if (overrideNames) text = text.replace(newRX(`\b${escapeRegExp(displayName)}\b`, "uig"), getEndearment());      
   }
   /* Replace any leftover user mentions with endearments */
   text = text.replace(/<@!?\s*\d+>/uig, getEndearment());


   if (!members) return text;
   
   /* Replace @User or raw @!UserID messages with display name or an endearment if overrideNames is true */
   members.fetch().then(fetchedMembers => {
      fetchedMembers.forEach(member => {
         const displayName = getDisplayName(member.user, members);
         text = text.replace(newRX(`<@!?\s*${escapeRegExp(member.id)}>`, "uig"), displayName);
         if (overrideNames) text = text.replace(newRX(`\b${escapeRegExp(displayName)}\b`, "uig"), getEndearment());
      });        
   });


   return text;
}

export { getDisplayName, interpolateUsers, getEndearment, KnownUser, KnownUsers, Conversation }
