import { mkdir, appendFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

export function dateStamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export class JsonlStorage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
  }

  append(kind, payload, timestamp = Date.now()) {
    const line = JSON.stringify(payload) + "\n";
    const filePath = path.join(this.dataDir, `${kind}-${dateStamp(timestamp)}.jsonl`);

    this.writeQueue = this.writeQueue
      .then(() => appendFile(filePath, line, "utf8"))
      .catch((error) => {
        console.error(`Failed to append ${kind} record`, error);
      });

    return this.writeQueue;
  }

  async *readLines(kind, dateStr) {
    const filePath = path.join(this.dataDir, `${kind}-${dateStr}.jsonl`);
    let fileStream;

    try {
      fileStream = createReadStream(filePath, { encoding: "utf8" });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line);
      } catch (err) {
        console.error(`Failed to parse ${kind} line`, err);
      }
    }
  }
}
