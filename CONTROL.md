# Control Statement: Provenance-Based Retrieval Filtering

## Maps to

- **OWASP Top 10 for LLM Applications (2025) — LLM08: Vector and Embedding Weaknesses.** This control addresses the specific failure mode described there: content (including a system's own generated output) can be inserted into a vector store and rank highly in similarity search, causing the system to repeatedly retrieve and act on poisoned context.
- **NIST AI Risk Management Framework — MEASURE and MANAGE functions**, specifically around tracking data provenance and lineage as an input to model reliability.

## Objective

Prevent a RAG system's own generated output from being retrieved and treated as trustworthy source material in future responses, without relying on after-the-fact detection of AI-generated text (which is unreliable and explicitly out of scope for this control).

## Mechanism

1. Every piece of content ingested into the vector store is tagged at write time with a `provenance` field: `"human"`, `"generated"`, or `"unknown"`.
2. Content with no explicit provenance tag defaults to `"unknown"` — not `"human"`. This is a fail-closed default: an ingestion path that forgets to tag content does not silently grant it trusted status.
3. At retrieval time, an optional filter (`filter=human`) restricts the vector search to an allowlist of `provenance: "human"` content only, using a Vectorize metadata index on the `provenance` field.
4. The filter is opt-in per request, not a global setting, so the same system can serve both filtered (trusted-only) and unfiltered (full-index) queries depending on the caller's needs.

## Evidence

- **Unfiltered baseline (no control):** contamination reaches queries paraphrasing the poisoned content (up to 63% synthetic retrieval by iteration 10) and, to a lesser degree, topically adjacent queries on the same source documents (up to 32%). Topically unrelated queries remained uncontaminated. See `REPORT.md`, Results.
- **Control applied:** across 200 measurements (10 iterations × 20 questions across the two tiers known to be affected), synthetic fraction remained at 0.00 and top-1 provenance was `human` in every case, even as contamination continued to accumulate in the index in parallel. See `evidence/v2/gradient-controlled-log.csv`.
- **Fail-open default identified and fixed:** the control's first implementation defaulted untagged content to `"human"`, which would have defeated the filter for any ingestion path that omitted the tag. This was found, changed to a fail-closed `"unknown"` default, and verified directly by ingesting an untagged file and confirming it was excluded from filtered retrieval. See `REPORT.md`, Revision History, and commit history.

## Known Gaps

- **Coverage, not prevention.** The filter does not stop generated content from being written to the vector store — contamination still accumulates in the raw index. It only prevents that content from being *retrieved* when the filter is active. A caller that omits `filter=human` still sees the full, contaminated index.
- **Trust is inherited, not verified.** Content tagged `"human"` at ingestion is trusted on the strength of that tag alone. The control does not independently verify that human-tagged content is actually human-authored or actually accurate — it only prevents the specific failure mode of the system trusting its own prior outputs.
- **Single point of enforcement.** The filter is applied at query time in one code path. Any additional ingestion or retrieval path added to the system in the future must independently apply the same tagging and filtering discipline, or the control does not extend to it automatically.
- **Not validated at scale.** Tested against a 15-document corpus and 10 contamination cycles on Cloudflare's free tier. Behavior under production data volumes, concurrent writers, or adversarial (not just self-generated) poisoning attempts is untested.
- **Untested against confirmed non-contaminated content.** The control was validated on tiers where contamination was confirmed to occur (B1, B2). It was not tested on content that was never contaminated (B3), since a positive result there would not distinguish "the control works" from "there was nothing to filter."
