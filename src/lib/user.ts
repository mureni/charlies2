import { User, GuildMember } from "discord.js";

const getUser = (member: User | GuildMember) => {
   let displayName: string;
   if (member instanceof GuildMember) {
      displayName = (member.displayName) ? member.displayName : member.user.username;      
   } else if (member instanceof User) {
      displayName = member.username;
   } else {
      displayName = "[Unknown]";
   }
   return displayName;
}

export { getUser }