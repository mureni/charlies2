import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas", () => {
   const context = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      arc: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fill: vi.fn(),
      fillStyle: ""
   };
   const createCanvas = vi.fn(() => ({
      getContext: () => context,
      toBuffer: () => Buffer.from("image")
   }));
   return { default: { createCanvas } };
});

vi.mock("fs", async (importOriginal) => {
   const actual = await importOriginal();
   return {
      ...(actual as Record<string, unknown>),
      writeFileSync: vi.fn()
   };
});

describe("gcpdot controller", () => {
   afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
   });

   it("renders dot images using the canvas pipeline", async () => {
      const { GCPDot } = await import("@/plugins/modules/gcpdot/controller");
      const { default: Canvas } = await import("canvas");
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "0.96" })) as unknown as typeof fetch);
      vi.spyOn(GCPDot, "parseDotResults").mockReturnValue({
         color: "#abc",
         explanation: "ok",
         index: 0.42
      });

      const result = await GCPDot.getDotData();

      expect(Canvas.createCanvas).toHaveBeenCalledWith(50, 50);
      expect(result.image.equals(Buffer.from("image"))).toBe(true);
      expect(result.data.color).toBe("#abc");
   });

   it("writes the generated image to disk", async () => {
      const { GCPDot } = await import("@/plugins/modules/gcpdot/controller");
      const fs = await import("fs");
      const writeFileSync = vi.mocked(fs.writeFileSync);
      vi.spyOn(GCPDot, "getDotData").mockResolvedValue({
         image: Buffer.from("bytes"),
         data: { color: "#fff", explanation: "ok", index: 0.5 }
      });

      await GCPDot.saveDotImage("out.png");

      expect(writeFileSync).toHaveBeenCalledWith("out.png", expect.any(Buffer));
   });

   it("falls back to a default color when no data is present", async () => {
      const { GCPDot } = await import("@/plugins/modules/gcpdot/controller");
      const result = GCPDot.parseDotResults("");
      expect(result.color).toBe("#CDCDCD");
   });
});
