import * as fs from "fs";
import * as path from "path";

/*
   Simple hack, not very flexible. Writes: 
   {
      [key]: { [value] }[,]
   }
   One key at a time. 
*/

const saveBigJSON = (file: string, object: any) => {

   // Ensure path is ok to write to
   if (!path.resolve(path.dirname(file))) throw new Error(`Unable to resolve path for ${file}`);

   try {
      // Create writeable stream 
      const ws = fs.createWriteStream(file);

      ws.write("{");

      // Analyze object
      if (typeof object !== "object") throw new Error(`Cannot save object of type ${typeof object}`);
      
      const objectSize: number = Object.keys(object).length;
      let currentPosition: number = 1;
      let dataSize: number = 1;

      for (const [key, value] of Object.entries(object)) {
         const isLastElement: boolean = (currentPosition >= objectSize);
         const data = JSON.stringify(value);
         ws.write(`"${key}":${data}`);
         if (!isLastElement) ws.write(",");
         currentPosition++;
         dataSize += (key.length + 3 + data.length + 1);
      }
      
      console.log(`Saved ${dataSize} bytes to ${file}`);

      ws.write("}");
      // Close stream
      ws.close();

   } catch (e) {
      throw new Error(`Error saving to ${file}: ${e}`);
   }
}

export { saveBigJSON }