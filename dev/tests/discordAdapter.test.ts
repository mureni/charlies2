import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { createDiscordAdapter, toDiscordEmbed, toStandardChannel, toStandardMessage, toStandardCommandInteraction } from "@/platform/discordAdapter";
import { initEnvConfig } from "@/utils";

describe("discord adapter", () => {
   interface MockClientBundle {
      client: {
         channels: { cache: Map<string, any>; fetch: (id: string) => Promise<any> };
         guilds: { cache: Map<string, any> };
         user: { id: string };
         application: { commands: { set: (value: unknown) => Promise<void> } };
      };
      channel: {
         id: string;
         name: string;
         type: ChannelType;
         send: (value: unknown) => Promise<void>;
         sendTyping: () => Promise<void>;
         permissionsFor: () => { has: (perm: bigint) => boolean };
      };
      channelSend: ReturnType<typeof vi.fn>;
      channelTyping: ReturnType<typeof vi.fn>;
      application: { commands: { set: (value: unknown) => Promise<void> } };
      permissionsFor: ReturnType<typeof vi.fn>;
   }

   const makeClient = (): MockClientBundle => {
      const channelSend = vi.fn(async () => undefined);
      const channelTyping = vi.fn(async () => undefined);
      const permissionsFor = vi.fn(() => ({
         has: (perm: bigint) => perm === PermissionFlagsBits.SendMessages || perm === PermissionFlagsBits.ReadMessageHistory
      }));
      const channel = {
         id: "channel-1",
         name: "general",
         type: ChannelType.GuildText,
         send: channelSend,
         sendTyping: channelTyping,
         permissionsFor
      };

      const channelsCache = new Map<string, any>([["channel-1", channel]]);
      const guildChannelsCache = new Map<string, any>([["channel-1", channel]]);

      const guild = {
         id: "guild-1",
         name: "Guild",
         channels: { cache: guildChannelsCache },
         members: {
            fetch: vi.fn(async (userId: string) => ({ id: userId, user: { id: userId, username: "Member" }, displayName: "Member" }))
         }
      };

      const guilds = { cache: new Map<string, any>([["guild-1", guild]]) };
      const channels = {
         cache: channelsCache,
         fetch: vi.fn(async (id: string) => channelsCache.get(id))
      };

      const application = { commands: { set: vi.fn(async () => undefined) } };

      const client = {
         channels,
         guilds,
         user: { id: "bot-1" },
         application
      };

      return { client, channel, channelSend, channelTyping, application, permissionsFor };
   };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("builds discord embeds with attachment URLs", () => {
      const embed = toDiscordEmbed({
         title: "Title",
         description: "Desc",
         color: "#ff0000",
         thumbnailAttachmentName: "thumb.png",
         imageAttachmentName: "image.png"
      });

      expect(embed.title).toBe("Title");
      expect(embed.thumbnail?.url).toBe("attachment://thumb.png");
      expect(embed.image?.url).toBe("attachment://image.png");
   });

   it("ignores invalid embed colors", () => {
      const embed = toDiscordEmbed({
         title: "Bad Color",
         color: "not-a-color"
      });

      expect(embed.title).toBe("Bad Color");
      expect(embed.color).toBeUndefined();
   });

   it("sends messages with fallback content and typings", async () => {
      const { client, channel, channelSend, channelTyping, application } = makeClient();
      const message = {
         id: "msg-1",
         client,
         channel,
         reply: vi.fn(async () => undefined)
      } as any;
      const adapter = createDiscordAdapter(message);

      await adapter.sendMessage("channel-1", {
         contents: "",
         embeds: [{ title: "Hello" }],
         attachments: [{ name: "file.txt", data: Buffer.from("data") }]
      });
      await adapter.sendTyping("channel-1");

      expect(channelSend).toHaveBeenCalledWith(expect.objectContaining({
         content: " ",
         embeds: expect.any(Array),
         files: expect.any(Array)
      }));
      expect(channelTyping).toHaveBeenCalled();

      if (!adapter.registerCommands) throw new Error("registerCommands missing in adapter");
      await adapter.registerCommands([{
         name: "hello",
         description: "Hello",
         options: [{ name: "target", description: "Target", type: "string", required: true }],
         permissions: ["ADMINISTRATOR"]
      }]);

      const expectedPermissions = new PermissionsBitField([PermissionFlagsBits.Administrator]).bitfield.toString();
      expect(application.commands.set).toHaveBeenCalledWith([
         expect.objectContaining({
            name: "hello",
            default_member_permissions: expectedPermissions
         })
      ]);
   });

   it("resolves standard channel metadata for group DMs", () => {
      const channel = {
         id: "dm-1",
         type: ChannelType.GroupDM,
         recipients: [{ id: "u1" }, { id: "u2" }]
      } as any;

      const standard = toStandardChannel(channel);

      expect(standard.type).toBe("dm");
      expect(standard.isGroupDm).toBe(true);
      expect(standard.memberCount).toBe(2);
   });

   it("maps referenced messages and admin flags", async () => {
      process.env.BOT_OWNER_DISCORD_ID = "owner-1";
      initEnvConfig();
      try {
         const { client, channel } = makeClient();
         const referenced = {
            content: "quoted",
            mentions: { has: vi.fn(() => true) }
         };
         const message = {
            id: "msg-2",
            content: "hello",
            author: { id: "owner-1", username: "Owner", bot: false },
            channelId: "channel-1",
            channel,
            guild: { id: "guild-1", name: "Guild", members: { resolve: vi.fn(async () => ({ displayName: "Owner" })) } },
            member: {
               user: { id: "owner-1", username: "Owner" },
               displayName: "Owner",
               permissions: { has: vi.fn((perm: bigint) => perm === PermissionFlagsBits.ManageGuild) }
            },
            mentions: { has: vi.fn(() => true) },
            reference: { messageId: "msg-ref" },
            fetchReference: vi.fn(async () => referenced),
            client,
            tts: false
         } as any;

         const standard = await toStandardMessage(message);

         expect(standard.referencedContent).toBe("quoted");
         expect(standard.referencedMentionsBot).toBe(true);
         expect(standard.isAdmin).toBe(true);
         expect(standard.isBotOwner).toBe(true);
      } finally {
         delete process.env.BOT_OWNER_DISCORD_ID;
         initEnvConfig();
      }
   });

   it("skips sending when channel cannot be resolved", async () => {
      const { client, channelSend } = makeClient();
      client.channels.cache.clear();
      const message = {
         id: "msg-3",
         client,
         channel: { id: "channel-1" },
         reply: vi.fn(async () => undefined)
      } as any;
      const adapter = createDiscordAdapter(message);

      await adapter.sendMessage("missing-channel", { contents: "hi" });

      expect(channelSend).not.toHaveBeenCalled();
   });

   it("returns false for canSend when channel is missing", async () => {
      const { client } = makeClient();
      client.channels.cache.clear();
      const message = {
         id: "msg-4",
         client,
         channel: { id: "channel-1" },
         reply: vi.fn(async () => undefined)
      } as any;
      const adapter = createDiscordAdapter(message);

      const result = await adapter.canSend?.("missing-channel");

      expect(result).toBe(false);
   });

   it("returns an empty history when channel has no fetcher", async () => {
      const { client } = makeClient();
      client.channels.cache.set("channel-2", { id: "channel-2" });
      const message = {
         id: "msg-5",
         client,
         channel: { id: "channel-2" },
         reply: vi.fn(async () => undefined)
      } as any;
      const adapter = createDiscordAdapter(message);

      const history = await adapter.fetchHistory("channel-2", {});

      expect(history).toEqual([]);
   });

   it("handles missing referenced messages gracefully", async () => {
      const { client, channel } = makeClient();
      const message = {
         id: "msg-6",
         content: "hello",
         author: { id: "user-1", username: "User", bot: false },
         channelId: "channel-1",
         channel,
         guild: { id: "guild-1", name: "Guild", members: { resolve: vi.fn(async () => ({ displayName: "User" })) } },
         member: {
            user: { id: "user-1", username: "User" },
            displayName: "User",
            permissions: { has: vi.fn(() => false) }
         },
         mentions: { has: vi.fn(() => false) },
         reference: { messageId: "missing" },
         fetchReference: vi.fn(async () => { throw new Error("missing"); }),
         client,
         tts: false
      } as any;

      const standard = await toStandardMessage(message);

      expect(standard.referencedContent).toBeUndefined();
      expect(standard.referencedMentionsBot).toBeUndefined();
   });

   it("allows canSend when permissions are unavailable", async () => {
      const { client } = makeClient();
      const channel = {
         id: "channel-3",
         name: "general",
         type: ChannelType.GuildText
      };
      client.channels.cache.set("channel-3", channel);
      const message = {
         id: "msg-7",
         client,
         channel,
         reply: vi.fn(async () => undefined)
      } as any;
      const adapter = createDiscordAdapter(message);

      const result = await adapter.canSend?.("channel-3");

      expect(result).toBe(true);
   });

   it("flattens nested command options", async () => {
      const reply = vi.fn(async () => undefined);
      const followUp = vi.fn(async () => undefined);
      const interaction = {
         commandName: "demo",
         options: {
            data: [
               {
                  name: "group",
                  options: [{ name: "target", value: "alpha" }]
               },
               {
                  name: "count",
                  value: 2
               }
            ]
         },
         user: { id: "user-1" },
         channelId: "channel-1",
         guildId: "guild-1",
         replied: false,
         deferred: false,
         reply,
         followUp
      } as any;

      const standard = toStandardCommandInteraction(interaction);
      await standard.reply({ contents: "ok" });

      expect(standard.options).toEqual({ target: "alpha", count: 2 });
      expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: "ok" }));
   });

   it("uses followUp when interaction is deferred and ensures content placeholder", async () => {
      const reply = vi.fn(async () => undefined);
      const followUp = vi.fn(async () => undefined);
      const interaction = {
         commandName: "demo",
         options: { data: [] },
         user: { id: "user-1" },
         channelId: "channel-1",
         guildId: "guild-1",
         replied: false,
         deferred: true,
         reply,
         followUp
      } as any;

      const standard = toStandardCommandInteraction(interaction);
      await standard.reply({ contents: "", embeds: [{ title: "Embed" }] });

      expect(reply).not.toHaveBeenCalled();
      expect(followUp).toHaveBeenCalledWith(expect.objectContaining({
         content: " ",
         embeds: expect.any(Array)
      }));
   });

   it("skips command registration when application is missing", async () => {
      const { client, channel } = makeClient();
      client.application = undefined as unknown as { commands: { set: (value: unknown) => Promise<void> } };
      const message = {
         id: "msg-8",
         client,
         channel,
         reply: vi.fn(async () => undefined)
      } as any;
      const adapter = createDiscordAdapter(message);
      if (!adapter.registerCommands) throw new Error("registerCommands missing");

      await expect(adapter.registerCommands([{ name: "demo", description: "demo" }])).resolves.toBeUndefined();
   });
});
