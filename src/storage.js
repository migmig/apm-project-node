import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

function dateStamp(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
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
}
