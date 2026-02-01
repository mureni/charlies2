   
import Canvas from "canvas";
import { log } from "@/core/log";
import { checkFilePath } from "@/utils";

import { writeFileSync } from "fs";
const DOT_FILENAME = checkFilePath("data", "gcpdot.png", true);
const DOT_URL = "http://gcpdot.com/gcpindex.php?small=1";
const DOT_SIZE = 50;
interface DotData {
    color: string,
    explanation: string,
    index: number
}
class GCPDot {

   public static async fetchGCPDotData() {
      let dotData: string = "";
      try {
         const response = await fetch(DOT_URL);
         if (response.ok) {
            dotData = await response.text();
         }
      } catch (e) {
         // handle failure to fetch data
         log(`Unable to fetch GCP dot data: ${JSON.stringify(e, null, 2)}`, "warn");
      }
      return dotData;
   }

   public static async getDotData(): Promise<{ image: Buffer, data: DotData }> {
      const data = await GCPDot.fetchGCPDotData();
      const dotResults = GCPDot.parseDotResults(data);

        
      const canvas = Canvas.createCanvas(DOT_SIZE, DOT_SIZE);
      const context = canvas.getContext("2d");
      const radius = DOT_SIZE * 0.45;
      const middle = { x: DOT_SIZE / 2, y: DOT_SIZE / 2 };
      const parseHexColor = (hex: string) => {
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
      const toRgba = (color: { r: number, g: number, b: number, a: number }) =>
         `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      const mix = (base: { r: number, g: number, b: number, a: number }, target: { r: number, g: number, b: number }, amount: number) => ({
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

   public static async saveDotImage(filename: string = DOT_FILENAME) {
      const dotData = await GCPDot.getDotData();
      writeFileSync(filename, dotData.image);
   }

   public static parseDotResults(dotData: string): DotData {
      const values = dotData.match(/(0\.\d+)/g) ?? [];
      const highest = Math.max(...values.map(v => parseFloat(v)));
      log(`GCP Dot highest value: ${highest} (values: ${values.join(", ")})`, "debug");
      let color: string, explanation: string;
      switch (true) {
         case (highest >= 0.95):
            color = "#2457fd";
            explanation = "Significantly small network variance. Suggestive of deeply shared, internally motivated group focus. The index is above 95%."
            break;
         case (highest >= 0.93 && highest < 0.95):
            color = "#0eb3ff";
            explanation = "Small network variance. Probably chance fluctuation. The index is between 93% and 95%.";
            break;
         case (highest >= 0.9125 && highest < 0.93):
            color = "#ACF2FF";
            explanation = "Small network variance. Probably chance fluctuation. The index is between 91.25% and 93%.";
            break;
         case (highest >= 0.90 && highest < 0.9125):
            color = "#64FAAB";
            explanation = "Small network variance. Probably chance fluctuation. The index is between 90% and 91.25%.";
            break;
         case (highest >= 0.40 && highest < 0.90):
            color = "#64FA64";
            explanation = "Normally random network variance. This is average or expected behavior. The index is between 40% and 90%.";
            break;
         case (highest >= 0.30 && highest < 0.40):
            color = "#AEFA00";
            explanation = "Normally random network variance. This is average or expected behavior. The index is between 30% and 40%.";
            break;
         case (highest >= 0.23 && highest < 0.30):
            color = "#F9FA00";
            explanation = "Slightly increased network variance. Probably chance fluctuation. The index is between 23% and 30%.";
            break;
         case (highest >= 0.15 && highest < 0.23):
            color = "#F9FA00";
            explanation = "Slightly increased network variance. Probably chance fluctuation. The index is between 15% and 23%.";
            break;
         case (highest >= 0.08 && highest < 0.15):
            color = "#FFD517";
            explanation = "Slightly increased network variance. Probably chance fluctuation. The index is between 8% and 15%.";
            break;
         case (highest >= 0.05 && highest < 0.08):
            color = "#FFB82E";
            explanation = "Strongly increased network variance. May be chance fluctuation, with the index between 5% and 8%.";
            break;
         case (highest >= 0.01 && highest < 0.05):
            color = "#df541d";
            explanation = "Very strong increase in large network variance. Suggests broadly shared coherence of thought and emotion. The index is between 1% and 5%.";
            break;
         case (highest >= 0.00 && highest < 0.01):
            color = "#df1d1dff";
            explanation = "Significantly large network variance. Suggests broadly shared coherence of thought and emotion. The index is less than or equal to 1%.";
            break;
         default:
            color = "#CDCDCD";
            explanation = "Something is wrong with the GCP Dot!";
      }
      return { color: color, explanation: explanation, index: highest };
   }
}

export { GCPDot };
