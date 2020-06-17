import { User, GuildMember, Collection, Snowflake } from "discord.js";

const getEndearment = (plural: boolean = false): string => {
   const synonyms = ["pal", plural ? "buddie" : "buddy", "chum", "compadre", "comrade", "friend", "my friend", "mate", "amigo", "fella", "bro", "broseph", "darling", "sweetheart", "sweetpea", "honey", "sweetie"];
   const endearment = synonyms[Math.floor(Math.random() * synonyms.length)];
   return `${endearment}${plural ? "s" : ""}`;
}

const getDisplayName = (member: User | GuildMember) => {
   let displayName: string = "";
   if (member instanceof GuildMember) {
      displayName = (member.displayName) ? member.displayName : member.user.username;      
   } else if (member instanceof User) {
      displayName = member.username;
   }
   return displayName;
}

const escapeRegExp = (rx: string) => {
   return rx.replace(/[.*+?^${}()|[\]\\]/ug, '\\$&');
};

const interpolateUsers = (text: string, members: Collection<Snowflake, User> | Collection<Snowflake, GuildMember> | undefined = undefined, overrideNames: boolean = false): string => {   
   /* Replace @User or raw @!UserID messages with display name or an endearment if overrideNames is true */
   if (members !== undefined) {
      for (const memberID of members.keys()) {
         const member = members.get(memberID) as User | GuildMember;         
         const name = getDisplayName(member);         
         text = text.replace(new RegExp(`<@!?${escapeRegExp(member.id)}>`, "uig"), name);
         if (overrideNames) text = text.replace(new RegExp(escapeRegExp(name), "uig"), getEndearment());
      }
   }
   /* Swap @roles, @everyone, @here references with "my friends" */
   text = text.replace(/<@&\d+>/uig, getEndearment(true));
   text = text.replace(/@everyone|@here/uig, getEndearment(true));
   return text;
}

export { getDisplayName, interpolateUsers, getEndearment }