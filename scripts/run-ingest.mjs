// scripts/run-ingest.mjs
// Reads all files in corpus/, POSTs them ONE AT A TIME to avoid Worker timeout

import { readdir, readFile } from "fs/promises";
import { join } from "path";

const CORPUS_DIR = "./corpus";
const INGEST_URL = process.argv[2];

if (!INGEST_URL) {
  console.error("Usage: node scripts/run-ingest.mjs <ingest-worker-url>/ingest");
  process.exit(1);
}

async function main() {
  const filenames = (await readdir(CORPUS_DIR)).filter(f => f.endsWith(".txt"));
  console.log(`Found ${filenames.length} files. Ingesting one at a time...`);

  let totalChunks = 0;

  for (const name of filenames) {
    const content = await readFile(join(CORPUS_DIR, name), "utf-8");

    console.log(`Sending ${name}...`);

    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [{ name, content }] }),
    });

    if (!response.ok) {
      console.error(`  FAILED (${response.status}): ${name}`);
      continue;
    }

    const result = await response.json();
    console.log(`  ${result.files[0]}`);
    totalChunks += result.totalChunks;
  }

  console.log(`\nDone. Total chunks ingested: ${totalChunks}`);
}

main().catch(console.error);
