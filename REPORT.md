# RAG Self-Contamination Lab — Report

## Incident Context

While building ForensicGraph (an AI-assisted digital forensics workbench), a RAG-based retrieval system began citing its own previously generated answers as if they were case evidence, corrupting its own outputs over time. This project reproduces that failure mode in a small, controlled system, measures it, and designs a control that stops it.

## Hypothesis

RAG systems without provenance tracking can suffer "RAG collapse" — a system's own generated outputs get re-indexed and retrieved as source material, causing quality to degrade over repeated cycles. The severity of that degradation depends on how semantically close a query is to the content that contaminated the index.

## Method

1. Built a minimal RAG system on Cloudflare Workers, Workers AI (BGE embeddings + Llama 3.1 8B generation), and Vectorize.
2. Ingested a 15-document corpus (network security fundamentals, ~57K words, sourced from Wikipedia) with provenance metadata: `{source, provenance, gen_depth, ingested_at}`.
3. Split the eval set into four groups:
   - **Set A** (10 questions): used to contaminate the index — answers fed back in as `provenance: "generated"` each iteration.
   - **Set B1** (10 questions): paraphrases of Set A questions — same intent, different wording.
   - **Set B2** (10 questions): adjacent questions on the same source documents as Set A, different facet.
   - **Set B3** (5 questions): topically unrelated to Set A.
4. Ran 10 iterations: each iteration, asked all of Set A and fed the generated answers back into the index tagged with the current iteration as `gen_depth`. Then measured retrieval on B1, B2, and B3 without modifying the index further.
5. Logged synthetic fraction of retrieved chunks and top-1 provenance per question per iteration, per tier.
6. Implemented a provenance filter (`filter=human`) at retrieval time, defaulting untagged content to `"unknown"` rather than `"human"` (see Revision History). Re-ran the identical loop with the control ON, measuring only B1 and B2 — the tiers where contamination was shown to occur.

## Results

**Unfiltered, by iteration 10 (mean synthetic fraction of retrieved chunks):**

| Tier | Iteration 1 | Iteration 10 |
|---|---|---|
| B1 (paraphrases) | 0.00 | 0.63 |
| B2 (adjacent facets) | 0.00 | 0.32 |
| B3 (unrelated) | 0.00 | 0.00 |

Contamination concentrates on the queries closest — semantically — to what corrupted the index. Paraphrases of contaminated questions are hit hardest and fastest. Adjacent questions on the same source documents are affected, but less severely. Topically unrelated questions stayed clean across all 10 iterations, 50 data points, zero exceptions.

**Controlled (provenance filter ON), B1 and B2 only, 10 iterations:** synthetic fraction remained at 0.00, top-1 provenance was `human` on every single measurement — 200 data points, zero exceptions — even as contamination continued accumulating in the index in parallel. The control was not tested on B3, since B3 was never contaminated in the unfiltered run either; testing the control there would prove nothing about whether it works.

See `analysis/charts/v2/gradient_by_tier.png` for the visualization, and `evidence/v2/` for raw logs.

## Control Design

The fix does not attempt to detect AI-generated text after the fact — text-detection is known to be unreliable, which is part of why this failure mode exists. Instead, content is tagged with its provenance at write time (human, generated, or unknown) and the retrieval layer allowlists only `"human"`-tagged content when the filter is enabled. This is enforced via a Vectorize metadata index on the `provenance` field.

## Limitations

- Corpus size: 15 documents (~57K words), not the originally scoped 30.
- Two of the 15 source documents required splitting into two parts each to avoid Worker execution timeouts during ingestion.
- Single generation model (Llama 3.1 8B Instruct Fast), single embedding model (BGE base).
- Single run: no fixed temperature, no seed, n=15 core questions, no variance across repeated runs reported. Sufficient for a toy lab; not sufficient to claim statistical significance.
- The B1/B2/B3 tier boundaries were constructed by hand rather than measured on a continuous semantic-distance scale — the categories are a reasonable proxy for "close vs. far" but not a precise metric.
- All testing used Cloudflare Workers AI's free tier; a production system would need this validated at larger scale and under sustained load.

## Future Work

- Measure semantic distance continuously (e.g., embedding cosine distance between Set A and each B-tier question) rather than using hand-assigned tiers.
- Score answer correctness against reference answers directly, not just retrieval provenance, to show contamination actually degrades answer quality and not just source mix.
- Track mean gen_depth of retrieved chunks over iterations to show compounding.
- Repeat the full loop multiple times to report variance, not single-run point estimates.
- Test with a larger, more diverse corpus.

## Revision History

**v1.0** (tagged, evidence in `evidence/v1/` and `analysis/charts/v1/`) established the incident → lab → control shape, but had two design flaws that made both the positive and the "proof" results guaranteed by construction rather than genuinely tested:

1. **The original experiment could not fail.** v1 contaminated the index with answers to the same 15 questions it then re-asked. A generated answer to question Q is, by construction, the most semantically similar text in the index to Q, so it was always going to win top-5 retrieval. This was redesigned into the current A / B1 / B2 / B3 structure, where contamination is measured on questions that were never used to produce the contaminating content — a test that could genuinely fail, and initially did (B3 stayed at 0.00 in the very first redesign, before the tiered gradient revealed that B1 and B2 do show real contamination).

2. **The control had a fail-open default.** In the original `handleIngest`, a missing `provenance` field defaulted to `"human"` — any ingestion path that forgot to tag content would launder it as trusted, silently defeating the filter. The default was changed to `"unknown"`, and the filter was rewritten as an explicit allowlist on `"human"` only. This was verified directly: an untagged test file was ingested and confirmed excluded from filtered results (see commit history around the fail-open fix).

3. **The drift metric measured the wrong thing.** v1's "answer drift" score (word overlap between an answer and its own baseline) sat at roughly the same ~0.30–0.35 whether or not the index was contaminated — including in the fully controlled run, where synthetic fraction was 0.00 throughout. That is the noise floor of LLM sampling and a coarse word-overlap metric, not evidence that answer quality stayed stable. The metric was retired in favor of the tiered synthetic-fraction gradient, which does show a real, reproducible signal.

See tag `v1.0` for the exact original code, experiment design, and results.

## Reproduce

See the "Reproducing this project" section in `README.md`.
