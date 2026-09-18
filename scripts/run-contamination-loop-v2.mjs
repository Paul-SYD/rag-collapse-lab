// scripts/run-contamination-loop-v2.mjs
// v2: Contaminates using Set A answers, measures collapse on held-out Set B.
// This tests whether contamination spreads beyond the exact queries that produced it.

import { readFile, writeFile, appendFile, access } from "fs/promises";

const ASK_URL = process.argv[2];
const INGEST_URL = process.argv[3];
const ITERATIONS = parseInt(process.argv[4] || "10", 10);
const START_ITER = parseInt(process.argv[5] || "1", 10);
const FILTER = process.argv[6] === "controlled"; // pass "controlled" as 6th arg to run WITH the filter

if (!ASK_URL || !INGEST_URL) {
  console.error("Usage: node scripts/run-contamination-loop-v2.mjs <ask-url> <ingest-url> [iterations] [start_iter] [controlled]");
  process.exit(1);
}

const LOG_PATH = FILTER ? "./evidence/v2/m5-comparison-log.csv" : "./evidence/v2/m3-contamination-log.csv";

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  const questionsRaw = await readFile("./eval/questions.json", "utf-8");
  const allQuestions = JSON.parse(questionsRaw);
  const setA = allQuestions.filter(q => q.set === "A");
  const setB = allQuestions.filter(q => q.set === "B");

  console.log(`Set A (contamination source): ${setA.length} questions`);
  console.log(`Set B (held-out measurement): ${setB.length} questions`);
  console.log(`Mode: ${FILTER ? "CONTROLLED (filter=human)" : "UNFILTERED"}`);

  const logExists = await fileExists(LOG_PATH);
  if (!logExists) {
    await writeFile(LOG_PATH, "iteration,question_id,set,synthetic_fraction,top1_provenance\n");
  }

  const endIter = START_ITER + ITERATIONS - 1;

  for (let iter = START_ITER; iter <= endIter; iter++) {
    console.log(`\n=== Iteration ${iter} ===`);

    // Step 1: Ask Set A questions, feed answers back as contamination
    for (const q of setA) {
      const askUrl = `${ASK_URL}?q=${encodeURIComponent(q.question)}`;
      const res = await fetch(askUrl);
      if (!res.ok) { console.error(`  [A${q.id}] ask FAILED (${res.status})`); continue; }
      const data = await res.json();

      // Feed this Set A answer back into the index, tagged generated
      await fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            name: `v2-generated-A${q.id}-iter${iter}.txt`,
            content: data.answer || "",
            provenance: "generated",
            gen_depth: iter,
          }],
        }),
      });
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`  Contaminated index with ${setA.length} Set A answers.`);

    // Step 2: Measure on Set B (held-out) — this is what we actually log
    for (const q of setB) {
      const filterParam = FILTER ? "&filter=human" : "";
      const askUrl = `${ASK_URL}?q=${encodeURIComponent(q.question)}${filterParam}`;
      const res = await fetch(askUrl);
      if (!res.ok) { console.error(`  [B${q.id}] measure FAILED (${res.status})`); continue; }
      const data = await res.json();

      const sources = data.sources_used || [];
      const syntheticCount = sources.filter(s => s.provenance === "generated").length;
      const syntheticFraction = sources.length ? syntheticCount / sources.length : 0;
      const top1Provenance = sources[0]?.provenance || "unknown";

      const row = `${iter},${q.id},B,${syntheticFraction.toFixed(3)},${top1Provenance}\n`;
      await appendFile(LOG_PATH, row);
      console.log(`  [B${q.id}] synthetic=${syntheticFraction.toFixed(2)} top1=${top1Provenance}`);

      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\nDone. Log at ${LOG_PATH}`);
}

main().catch(console.error);
