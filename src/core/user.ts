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

const getDisplayName = async (member: User, memberManager?: GuildMemberManager) => {
   let displayName: string = "";
   
   displayName = member.username;
   try {
      if (memberManager) {
         const resolvedUser = await memberManager.resolve(member);
         if (resolvedUser) displayName = resolvedUser.displayName;
      }
   } catch (e) {
      // GUILD_MEMBERS_TIMEOUT is trash and throws errors that shouldn't be process-ending
      displayName = member.username;
   }
   
   if (displayName === "") displayName = "<UNKNOWN USER>";

   return displayName;
}

const escapeRegExp = (rx: string) => {
   return rx.replace(/[.*+?^${}()|[\]\\]/ug, '\\$&');
};
// TODO: Change user interpolation from getting discord info to internal KnownUsers

const interpolateUsers = async (text: string, members: GuildMemberManager | undefined = undefined, useEndearments: boolean = false): Promise<string> => {   
   // TODO: Find better way to prevent 'directed to' (where first part of text is 'person:') from being interpolated
   /* Capture the 'directed to' part and save it until the end
    - Possible issue with this is if there is no 'directed to' but there is a colon, then this 'captured' data 
      will not be interpolated properly.
   */
   const [ directedTo ] = text.match(/^(.+?:)/gui) ?? [ "" ];
   // Remove anything it found for directed to
   if (directedTo !== "") text = text.replace(newRX(`^${escapeRegExp(directedTo)}`, "uig"), "");
   const backupName = useEndearments ? getEndearment : () => "<UNKNOWN USER>";

   /* Replace raw @!UserID messages based on internal database of known users (whether they are still active or not) */
   // TODO: Save KnownUsers between program runs
   for (let id of KnownUsers.keys()) {
      const displayName = KnownUsers.get(id)?.name ?? backupName();
      /* Replace all known aliases for each user with the user's known name */
      // TODO: Do not replace words that are also in the lexicon as actual words 
      for (let alias of KnownUsers.get(id)?.aliases.values() ?? []) {         
         text = text.replace(newRX(`\\b${escapeRegExp(alias)}\\b`, "uig"), displayName);
      }
      text = text.replace(newRX(`<@!?\\s*${escapeRegExp(id)}>`, "uig"), displayName);
      if (useEndearments) text = text.replace(newRX(`\\b${escapeRegExp(displayName)}\\b`, "uig"), getEndearment());      
   }
   /* Replace any leftover user mentions with endearments, if appropriate */
   if (useEndearments) text = text.replace(/<@!?\s*\d+>/uig, getEndearment());

   /* Swap @roles, @everyone, @here references with plural endearment ('useEndearments' flag does not apply to these) */
   text = text.replace(/<@&\d+>/uig, getEndearment(true));
   text = text.replace(/@everyone|@here|@room/uig, getEndearment(true));
   
   if (members) {
      /* Replace @User or raw @!UserID messages with display name or an endearment if useEndearments is true */
      try {
         const fetchedMembers = await members.fetch();
         
         fetchedMembers.forEach(async member => {
            const displayName = await getDisplayName(member.user, members);
            text = text.replace(newRX(`<@!?\\s*${escapeRegExp(member.id)}>`, "uig"), displayName);
            if (useEndearments) text = text.replace(newRX(`\\b${escapeRegExp(displayName)}\\b`, "uig"), getEndearment());
         });        
         
      } catch (e) {         
         // NOOP - most likely GUILD_MEMBERS_TIMEOUT, irrelevant if it works really. 
         // TODO: Don't rely on GuildMemberManager to work consistently, build the list of KnownUsers otherwise
      }
   }

   return (directedTo !== "") ? `${directedTo}` + text : text;
}

export { getDisplayName, interpolateUsers, getEndearment, KnownUser, KnownUsers, Conversation }
