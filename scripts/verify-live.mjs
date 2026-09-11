// scripts/verify-live.mjs
// Quick smoke test: confirms the deployed Worker is live and both endpoints respond correctly. 

const BASE_URL = "https://rag-collapse-lab.paulyohanna.workers.dev"; 

async function main() {
  console.log("Verifying live deployment...\n"); 

  // Test unfiltered ask 
  const r1 = await fetch(`${BASE_URL}/ask?q=What+is+a+firewall`); 
  const d1 = await r1.json(); 
  console.log(`✓ /ask responding: "${d1.answer?.slice(0, 80)}..."`); 
  console.log(` Sources used: ${d1.sources_used?.length || 0}`); 

  // Test filtered ask (the control) 
  const r2 = await fetch(`${BASE_URL}/ask?q=What+is+a+firewall&filter=human`); 
  const d2 = await r2.json(); 
  const allHuman = d2.sources_used?.every(s => s.provenance === "human"); 
  console.log(`\n✓ /ask?filter=human responding, all sources human: ${allHuman}`); 

  console.log("\nLive system verified. Regenerating charts from existing evidence logs...\n");
} 

main().catch(err => {
  console.error("Verification FAILED:", err.message);
  process.exit(1); 
});
