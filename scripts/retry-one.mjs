// scripts/retry-one.mjs
// Retry ingesting a single file by name
import { readFile } from "fs/promises";

const filename = process.argv[2];
const INGEST_URL = process.argv[3];

if (!filename || !INGEST_URL) {
  console.error("Usage: node scripts/retry-one.mjs <filename> <ingest-url>");
  process.exit(1);
}

async function main() {
  const content = await readFile(`./corpus/${filename}`, "utf-8");
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [{ name: filename, content }] }),
  });

  if (!res.ok) {
    console.error(`FAILED (${res.status})`);
    const text = await res.text();
    console.error(text.slice(0, 300));
    return;
  }

  const result = await res.json();
  console.log(result);
}

main().catch(console.error);
