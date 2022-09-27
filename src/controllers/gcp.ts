   
import Canvas from "canvas";
import fetch from "node-fetch";
import { log } from "../core/log";
import { checkFilePath } from "../utils";

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
        const radius = DOT_SIZE / 2;
        const middle = { x: DOT_SIZE / 2, y: DOT_SIZE / 2 };
        context.beginPath();
        context.arc(middle.x, middle.y, radius, 0, 2 * Math.PI, false);
        context.fillStyle = dotResults.color;
        context.fill();

        const imageData = canvas.toBuffer('image/png');        
        return { image: imageData, data: dotResults };
    }

    public static async saveDotImage(filename: string = DOT_FILENAME) {
        const dotData = await GCPDot.getDotData();
        writeFileSync(filename, dotData.image);
    }

    public static parseDotResults(dotData: string): DotData {
        const values: RegExpMatchArray = dotData.match(/(0\.\d+)/g) ?? [];
        const highest = Math.max(...values.map(v => parseFloat(v)));
        let color: string, explanation: string;
        switch (true) {
            case (highest >= 1):
                color = '#24CBFD';
                explanation = 'Significantly small network variance. Suggestive of deeply shared, internally motivated group focus. The index is above 95%.'
                break;
            case (highest >= 0.95):
                color = '#0EEEFF';
                explanation = 'Small network variance. Probably chance fluctuation. The index is between 93% and 95%.';
                break;
            case (highest >= 0.93):
                color = '#ACF2FF';
                explanation = 'Small network variance. Probably chance fluctuation. The index is between 91.25% and 93%.';
                break;
            case (highest >= 0.9125):
                color = '#64FAAB';
                explanation = 'Small network variance. Probably chance fluctuation. The index is between 90% and 91.25%.';
                break;
            case (highest >= 0.90):
                color = '#64FA64';
                explanation = 'Normally random network variance. This is average or expected behavior. The index is between 40% and 90%.';
                break;
            case (highest >= 0.40):
                color = '#AEFA00';
                explanation = 'Normally random network variance. This is average or expected behavior. The index is between 30% and 40%.';
                break;
            case (highest >= 0.30):
                color = '#F9FA00';
                explanation = 'Slightly increased network variance. Probably chance fluctuation. The index is between 23% and 30%.';
                break;
            case (highest >= 0.23):
                color = '#F9FA00';
                explanation = 'Slightly increased network variance. Probably chance fluctuation. The index is between 15% and 23%.';
                break;
            case (highest >= 0.15):
                color = '#FFD517';
                explanation = 'Slightly increased network variance. Probably chance fluctuation. The index is between 8% and 15%.';
                break;
            case (highest >= 0.08):
                color = '#FFB82E';
                explanation = 'Strongly increased network variance. May be chance fluctuation, with the index between 5% and 8%.';
                break;
            case (highest >= 0.05):
                color = '#FF1E1E';
                explanation = 'Strongly increased network variance. May be chance fluctuation, with the index between 1% and 5%.';
                break;
            case (highest >= 0.01):
                color = '#FFA8C0';
                explanation = 'Significantly large network variance. Suggests broadly shared coherence of thought and emotion. The index is less than or equal to 1%.';
                break;
            default:
                color = '#CDCDCD';
                explanation = 'Something is wrong with the GCP Dot!';
        }
        return { color: color, explanation: explanation, index: highest };
    }
}

export { GCPDot };