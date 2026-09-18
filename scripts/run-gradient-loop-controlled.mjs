// scripts/run-gradient-loop-controlled.mjs
// Controlled version: contaminates with Set A, measures ONLY B1 and B2 (where
// contamination is known to occur) with filter=human applied.
// B3 is excluded — testing the control there would prove nothing, since B3
// was never contaminated in the unfiltered run either.

import { readFile, writeFile, appendFile, access } from "fs/promises";

const ASK_URL = process.argv[2];
const INGEST_URL = process.argv[3];
const ITERATIONS = parseInt(process.argv[4] || "10", 10);
const START_ITER = parseInt(process.argv[5] || "1", 10);

if (!ASK_URL || !INGEST_URL) {
  console.error("Usage: node scripts/run-gradient-loop-controlled.mjs <ask-url> <ingest-url> [iterations] [start_iter]");
  process.exit(1);
}

const LOG_PATH = "./evidence/v2/gradient-controlled-log.csv";

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  const questionsRaw = await readFile("./eval/questions.json", "utf-8");
  const allQuestions = JSON.parse(questionsRaw);
  const setA = allQuestions.filter(q => q.set === "A");
  const setB1 = allQuestions.filter(q => q.set === "B1");
  const setB2 = allQuestions.filter(q => q.set === "B2");

  console.log(`Set A: ${setA.length} | B1: ${setB1.length} | B2: ${setB2.length}`);
  console.log(`Mode: CONTROLLED (filter=human) — measuring B1 and B2 only`);

  const logExists = await fileExists(LOG_PATH);
  if (!logExists) {
    await writeFile(LOG_PATH, "iteration,question_id,tier,synthetic_fraction,top1_provenance\n");
  }

  const endIter = START_ITER + ITERATIONS - 1;

  for (let iter = START_ITER; iter <= endIter; iter++) {
    console.log(`\n=== Controlled Iteration ${iter} ===`);

    for (const q of setA) {
      const askUrl = `${ASK_URL}?q=${encodeURIComponent(q.question)}`;
      const res = await fetch(askUrl);
      if (!res.ok) { console.error(`  [A${q.id}] ask FAILED (${res.status})`); continue; }
      const data = await res.json();

      await fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            name: `gradient-controlled-generated-A${q.id}-iter${iter}.txt`,
            content: data.answer || "",
            provenance: "generated",
            gen_depth: iter,
          }],
        }),
      });
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`  Contaminated with ${setA.length} Set A answers.`);

    for (const [tierName, tierQuestions] of [["B1", setB1], ["B2", setB2]]) {
      for (const q of tierQuestions) {
        const askUrl = `${ASK_URL}?q=${encodeURIComponent(q.question)}&filter=human`;
        const res = await fetch(askUrl);
        if (!res.ok) { console.error(`  [${tierName}-${q.id}] measure FAILED (${res.status})`); continue; }
        const data = await res.json();

        const sources = data.sources_used || [];
        const syntheticCount = sources.filter(s => s.provenance === "generated").length;
        const syntheticFraction = sources.length ? syntheticCount / sources.length : 0;
        const top1Provenance = sources[0]?.provenance || "unknown";

        const row = `${iter},${q.id},${tierName},${syntheticFraction.toFixed(3)},${top1Provenance}\n`;
        await appendFile(LOG_PATH, row);
        console.log(`  [${tierName}-${q.id}] synthetic=${syntheticFraction.toFixed(2)} top1=${top1Provenance}`);

        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  console.log(`\nDone. Log at ${LOG_PATH}`);
}

main().catch(console.error);
