// scripts/run-controlled-loop.mjs
// Same as the contamination loop, but with the provenance filter ON.
// Proves the control keeps synthetic_fraction near zero even as contamination accumulates.

import { readFile, writeFile, appendFile, access } from "fs/promises";

const ASK_URL = process.argv[2];
const INGEST_URL = process.argv[3];
const ITERATIONS = parseInt(process.argv[4] || "10", 10);
const START_ITER = parseInt(process.argv[5] || "1", 10);

if (!ASK_URL || !INGEST_URL) {
  console.error("Usage: node scripts/run-controlled-loop.mjs <ask-url> <ingest-url> [iterations] [start_iter]");
  process.exit(1);
}

function simpleWordOverlapDrift(a, b) {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const shared = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  if (union === 0) return 0;
  return 1 - shared / union;
}

const LOG_PATH = "./evidence/m5-comparison-log.csv";

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  const questionsRaw = await readFile("./eval/questions.json", "utf-8");
  const questions = JSON.parse(questionsRaw);

  const baselineRaw = await readFile("./evidence/m2-baseline-results.json", "utf-8");
  const baseline = JSON.parse(baselineRaw);
  const baselineAnswers = Object.fromEntries(baseline.map(r => [r.id, r.answer || ""]));

  const logExists = await fileExists(LOG_PATH);
  if (!logExists) {
    await writeFile(LOG_PATH, "iteration,question_id,synthetic_fraction,top1_provenance,drift_score\n");
  }

  const endIter = START_ITER + ITERATIONS - 1;

  for (let iter = START_ITER; iter <= endIter; iter++) {
    console.log(`\n=== Controlled Iteration ${iter} ===`);

    for (const q of questions) {
      // Query WITH the filter (control ON)
      const url = `${ASK_URL}?q=${encodeURIComponent(q.question)}&filter=human`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  [${q.id}] FAILED (${res.status})`);
        continue;
      }
      const data = await res.json();

      const sources = data.sources_used || [];
      const syntheticCount = sources.filter(s => s.provenance === "generated").length;
      const syntheticFraction = sources.length ? syntheticCount / sources.length : 0;
      const top1Provenance = sources[0]?.provenance || "unknown";
      const drift = simpleWordOverlapDrift(baselineAnswers[q.id] || "", data.answer || "");

      const row = `${iter},${q.id},${syntheticFraction.toFixed(3)},${top1Provenance},${drift.toFixed(3)}\n`;
      await appendFile(LOG_PATH, row);
      console.log(`  [${q.id}] synthetic=${syntheticFraction.toFixed(2)} top1=${top1Provenance} drift=${drift.toFixed(2)}`);

      // Still feed the generated answer back in (contamination continues to accumulate in the index),
      // but the CONTROL means /ask with filter=human should ignore it regardless.
      const genDepth = iter;
      await fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            name: `controlled-generated-q${q.id}-iter${iter}.txt`,
            content: data.answer || "",
            provenance: "generated",
            gen_depth: genDepth,
          }],
        }),
      });

      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\nDone with controlled iterations ${START_ITER}-${endIter}. Log at ${LOG_PATH}`);
}

main().catch(console.error);
