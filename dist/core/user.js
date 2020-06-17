"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEndearment = exports.interpolateUsers = exports.getDisplayName = void 0;
const discord_js_1 = require("discord.js");
const getEndearment = (plural = false) => {
    const synonyms = ["pal", plural ? "buddie" : "buddy", "chum", "compadre", "comrade", "friend", "my friend", "mate", "amigo", "fella", "bro", "broseph", "darling", "sweetheart", "sweetpea", "honey", "sweetie"];
    const endearment = synonyms[Math.floor(Math.random() * synonyms.length)];
    return `${endearment}${plural ? "s" : ""}`;
};
exports.getEndearment = getEndearment;
const getDisplayName = (member) => {
    let displayName = "";
    if (member instanceof discord_js_1.GuildMember) {
        displayName = (member.displayName) ? member.displayName : member.user.username;
    }
    else if (member instanceof discord_js_1.User) {
        displayName = member.username;
    }
    return displayName;
};
exports.getDisplayName = getDisplayName;
const escapeRegExp = (rx) => {
    return rx.replace(/[.*+?^${}()|[\]\\]/ug, '\\$&');
};
const interpolateUsers = (text, members = undefined, overrideNames = false) => {
    /* Replace @User or raw @!UserID messages with display name or an endearment if overrideNames is true */
    if (members !== undefined) {
        for (const memberID of members.keys()) {
            const member = members.get(memberID);
            const name = getDisplayName(member);
            text = text.replace(new RegExp(`<@!?${escapeRegExp(member.id)}>`, "uig"), name);
            if (overrideNames)
                text = text.replace(new RegExp(escapeRegExp(name), "uig"), getEndearment());
        }
    }
    /* Swap @roles, @everyone, @here references with "my friends" */
    text = text.replace(/<@&\d+>/uig, getEndearment(true));
    text = text.replace(/@everyone|@here/uig, getEndearment(true));
    return text;
};
exports.interpolateUsers = interpolateUsers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL3VzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkNBQXNFO0FBRXRFLE1BQU0sYUFBYSxHQUFHLENBQUMsU0FBa0IsS0FBSyxFQUFVLEVBQUU7SUFDdkQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2pOLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN6RSxPQUFPLEdBQUcsVUFBVSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztBQUM5QyxDQUFDLENBQUE7QUFnQzBDLHNDQUFhO0FBOUJ4RCxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQTBCLEVBQUUsRUFBRTtJQUNuRCxJQUFJLFdBQVcsR0FBVyxFQUFFLENBQUM7SUFDN0IsSUFBSSxNQUFNLFlBQVksd0JBQVcsRUFBRTtRQUNoQyxXQUFXLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO0tBQ2pGO1NBQU0sSUFBSSxNQUFNLFlBQVksaUJBQUksRUFBRTtRQUNoQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztLQUNoQztJQUNELE9BQU8sV0FBVyxDQUFDO0FBQ3RCLENBQUMsQ0FBQTtBQXNCUSx3Q0FBYztBQXBCdkIsTUFBTSxZQUFZLEdBQUcsQ0FBQyxFQUFVLEVBQUUsRUFBRTtJQUNqQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDckQsQ0FBQyxDQUFDO0FBRUYsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLElBQVksRUFBRSxVQUF3RixTQUFTLEVBQUUsZ0JBQXlCLEtBQUssRUFBVSxFQUFFO0lBQ2xMLHdHQUF3RztJQUN4RyxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUU7UUFDeEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDcEMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQXVCLENBQUM7WUFDM0QsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3BDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hGLElBQUksYUFBYTtnQkFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztTQUNqRztLQUNIO0lBQ0QsZ0VBQWdFO0lBQ2hFLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN2RCxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMvRCxPQUFPLElBQUksQ0FBQztBQUNmLENBQUMsQ0FBQTtBQUV3Qiw0Q0FBZ0IifQ==