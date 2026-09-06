// scripts/run-baseline.mjs
// Runs the fixed eval set once against /ask and saves results as baseline evidence

import { readFile, writeFile } from "fs/promises";

const ASK_URL = process.argv[2];

if (!ASK_URL) {
  console.error("Usage: node scripts/run-baseline.mjs <ask-worker-url>/ask");
  process.exit(1);
}

async function main() {
  const questionsRaw = await readFile("./eval/questions.json", "utf-8");
  const questions = JSON.parse(questionsRaw);

  const results = [];

  for (const q of questions) {
    console.log(`Asking [${q.id}]: ${q.question}`);
    const url = `${ASK_URL}?q=${encodeURIComponent(q.question)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  FAILED (${res.status})`);
        results.push({ ...q, error: `HTTP ${res.status}` });
        continue;
      }
      const data = await res.json();
      results.push({
        id: q.id,
        question: q.question,
        reference: q.reference,
        answer: data.answer,
        sources_used: data.sources_used,
      });
      console.log(`  OK — ${data.sources_used.length} sources used`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ ...q, error: err.message });
    }

    // Small delay to be polite to the API
    await new Promise(r => setTimeout(r, 500));
  }

  await writeFile("./evidence/m2-baseline-results.json", JSON.stringify(results, null, 2));
  console.log(`\nDone. Saved ${results.length} results to evidence/m2-baseline-results.json`);
}

main().catch(console.error);
