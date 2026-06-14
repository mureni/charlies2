import Canvas from "canvas";
import { log } from "@/core/log";
import { checkFilePath, env } from "@/utils";

import { writeFileSync } from "fs";
const DOT_FILENAME = checkFilePath("data", "gcpdot.png", true);
const DEFAULT_GCP_DOT_URL = "https://rng.observer/api/gcp2";
const DOT_URL = env("GCP_DOT_URL", DEFAULT_GCP_DOT_URL) ?? DEFAULT_GCP_DOT_URL;
const DOT_SIZE = 50;
interface DotData {
    color: string,
    explanation: string,
    metric: string,
    value: string
}

interface RgbColor { r: number; g: number; b: number }
interface RgbaColor { r: number; g: number; b: number; a: number }
interface GCP2NetvarValue { netvar?: unknown }
interface GCP2CurrentNetvar { netvar?: unknown }
interface GCP2Response { currentNetvar?: unknown }

class GCPDot {

   public static async fetchGCPDotData(): Promise<string> {
      try {
         const response = await fetch(DOT_URL);
         if (response.ok) {
            return await response.text();
         }
         log(`Unable to fetch GCP dot data from ${DOT_URL}: status=${response.status}`, "warn");
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Unable to fetch GCP dot data from ${DOT_URL}: ${message}`, "warn");
      }
      return "";
   }

   public static async getDotData(): Promise<{ image: Buffer, data: DotData }> {
      const data = await GCPDot.fetchGCPDotData();
      const dotResults = GCPDot.parseDotResults(data);

      const canvas = Canvas.createCanvas(DOT_SIZE, DOT_SIZE);
      const context = canvas.getContext("2d");
      const radius = DOT_SIZE * 0.45;
      const middle = { x: DOT_SIZE / 2, y: DOT_SIZE / 2 };
      const parseHexColor = (hex: string): RgbaColor => {
         const normalized = hex.replace("#", "").trim();
         const value = normalized.length === 3
            ? normalized.split("").map((c) => c + c).join("")
            : normalized;
         const hasAlpha = value.length === 8;
         const r = parseInt(value.slice(0, 2), 16);
         const g = parseInt(value.slice(2, 4), 16);
         const b = parseInt(value.slice(4, 6), 16);
         const a = hasAlpha ? parseInt(value.slice(6, 8), 16) / 255 : 1;
         return { r, g, b, a };
      };
      const toRgba = (color: RgbaColor): string =>
         `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      const mix = (base: RgbaColor, target: RgbColor, amount: number): RgbaColor => ({
         r: Math.round(base.r + (target.r - base.r) * amount),
         g: Math.round(base.g + (target.g - base.g) * amount),
         b: Math.round(base.b + (target.b - base.b) * amount),
         a: base.a,
      });
      const base = parseHexColor(dotResults.color);
      const highlight = mix(base, { r: 255, g: 255, b: 255 }, 0.55);
      const shade = mix(base, { r: 0, g: 0, b: 0 }, 0.35);
      const edge = mix(base, { r: 0, g: 0, b: 0 }, 0.55);

      context.clearRect(0, 0, DOT_SIZE, DOT_SIZE);

      // Soft drop shadow below the dot.
      context.save();
      context.beginPath();
      context.ellipse(middle.x, middle.y + radius * 0.6, radius * 0.85, radius * 0.32, 0, 0, 2 * Math.PI);
      const shadowGradient = context.createRadialGradient(
         middle.x,
         middle.y + radius * 0.6,
         radius * 0.1,
         middle.x,
         middle.y + radius * 0.6,
         radius * 0.9
      );
      shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.35)");
      shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = shadowGradient;
      context.fill();
      context.restore();

      // Main sphere shading (light source above).
      context.beginPath();
      context.arc(middle.x, middle.y, radius, 0, 2 * Math.PI, false);
      const sphereGradient = context.createRadialGradient(
         middle.x - radius * 0.25,
         middle.y - radius * 0.35,
         radius * 0.15,
         middle.x,
         middle.y,
         radius
      );
      sphereGradient.addColorStop(0, toRgba(highlight));
      sphereGradient.addColorStop(0.4, toRgba(base));
      sphereGradient.addColorStop(0.75, toRgba(shade));
      sphereGradient.addColorStop(1, toRgba(edge));
      context.fillStyle = sphereGradient;
      context.fill();

      // Subtle specular highlight for a slightly shiny matte finish.
      context.save();
      context.beginPath();
      context.ellipse(
         middle.x - radius * 0.25,
         middle.y - radius * 0.4,
         radius * 0.55,
         radius * 0.3,
         -0.2,
         0,
         2 * Math.PI
      );
      const glossGradient = context.createRadialGradient(
         middle.x - radius * 0.35,
         middle.y - radius * 0.5,
         radius * 0.05,
         middle.x - radius * 0.2,
         middle.y - radius * 0.35,
         radius * 0.7
      );
      glossGradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      glossGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = glossGradient;
      context.fill();
      context.restore();

      const imageData = canvas.toBuffer("image/png");
      return { image: imageData, data: dotResults };
   }

   public static async saveDotImage(filename: string = DOT_FILENAME): Promise<void> {
      const dotData = await GCPDot.getDotData();
      writeFileSync(filename, dotData.image);
   }

   public static parseDotResults(dotData: string): DotData {
      let parsed: unknown;
      try {
         parsed = JSON.parse(dotData) as unknown;
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         throw new Error(`Unable to parse GCP 2.0 data: ${message}`);
      }

      if (!GCPDot.isRecord(parsed)) {
         throw new Error("Unable to parse GCP 2.0 data: response is not an object.");
      }

      const response = parsed as GCP2Response;
      if (!GCPDot.isRecord(response.currentNetvar)) {
         throw new Error("Unable to parse GCP 2.0 data: missing currentNetvar.");
      }

      const currentNetvar = response.currentNetvar as GCP2CurrentNetvar;
      if (!Array.isArray(currentNetvar.netvar)) {
         throw new Error("Unable to parse GCP 2.0 data: missing currentNetvar.netvar.");
      }

      const [first] = currentNetvar.netvar;
      if (!GCPDot.isRecord(first)) {
         throw new Error("Unable to parse GCP 2.0 data: missing first NetVar sample.");
      }

      const value = Number.parseFloat(String((first as GCP2NetvarValue).netvar ?? ""));
      log(`GCP 2.0 NetVar value: ${value}`, "debug");
      return GCPDot.describeNetvar(value);
   }

   private static describeNetvar(netvar: number): DotData {
      if (!Number.isFinite(netvar)) {
         return {
            color: "#94a3b8",
            explanation: "The GCP 2.0 NetVar value is currently unavailable.",
            metric: "NetVar",
            value: "Unknown"
         };
      }

      const bands = [
         {
            max: 50,
            color: "#e600de",
            label: "Normal",
            explanation: "GCP 2.0 reports normal live network variance."
         },
         {
            max: 100,
            color: "#00cef7",
            label: "Elevated",
            explanation: "GCP 2.0 reports elevated live network variance."
         },
         {
            max: 150,
            color: "#f7c53a",
            label: "High",
            explanation: "GCP 2.0 reports high live network variance."
         },
         {
            max: 200,
            color: "#ffff00",
            label: "Very High",
            explanation: "GCP 2.0 reports very high live network variance."
         },
         {
            max: Number.POSITIVE_INFINITY,
            color: "#ffffde",
            label: "Extreme",
            explanation: "GCP 2.0 reports extreme live network variance."
         }
      ];
      const band = bands.find(candidate => netvar < candidate.max) ?? bands[bands.length - 1];
      return {
         color: band.color,
         explanation: `${band.explanation} The NetVar value is ${netvar.toFixed(2)} (${band.label}).`,
         metric: "NetVar",
         value: netvar.toFixed(2)
      };
   }

   private static isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === "object" && value !== null;
   }
}

export { GCPDot };
