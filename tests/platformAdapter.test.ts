import { describe, expect, it } from "vitest";
import { toDiscordEmbed, OutgoingEmbed } from "../src/platform";

describe("platform adapter helpers", () => {
   it("builds a Discord embed from core embed input", () => {
      const input: OutgoingEmbed = {
         title: "Hello",
         description: "World",
         color: "#ffffff",
         fields: [{ name: "Field", value: "Value", inline: true }],
         footer: "Footer",
         thumbnailAttachmentName: "thumb.png",
         imageAttachmentName: "image.png"
      };

      const result = toDiscordEmbed(input);

      expect(result.title).toBe("Hello");
      expect(result.description).toBe("World");
      expect(result.footer?.text).toBe("Footer");
      expect(result.fields?.[0]).toEqual({ name: "Field", value: "Value", inline: true });
      expect(result.thumbnail?.url).toBe("attachment://thumb.png");
      expect(result.image?.url).toBe("attachment://image.png");
   });
});
