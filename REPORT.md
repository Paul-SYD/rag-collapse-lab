# RAG Self-Contamination Lab — Report

## Incident Context

While building ForensicGraph (an AI-assisted digital forensics workbench), a RAG-based retrieval system began citing its own previously generated answers as if they were case evidence — corrupting its own outputs over time. This project reproduces that failure mode in a small, controlled system, measures it, and designs a control that stops it.

## Hypothesis

RAG systems without provenance tracking can suffer "RAG collapse" — a system's own generated outputs get re-indexed and retrieved as source material, causing quality to degrade over repeated cycles, similar to model collapse in generative training.

## Method

1. Built a minimal RAG system on Cloudflare Workers, Workers AI (BGE embeddings + Llama 3.1 8B generation), and Vectorize.
2. Ingested a 15-document corpus (network security fundamentals, ~57K words, sourced from Wikipedia) with provenance metadata: `{source, provenance, gen_depth, ingested_at}`.
3. Ran a fixed 15-question eval set to establish a baseline.
4. Ran a contamination loop: for each of 10 iterations, asked all 15 questions, then fed each generated answer back into the index tagged `provenance: "generated"`, `gen_depth: <iteration>`.
5. Measured synthetic fraction of retrieved chunks and answer drift per iteration.
6. Implemented a provenance filter (`filter=human`) at retrieval time and re-ran the identical 10-iteration loop with the control ON.

## Results

**Without control:** Mean synthetic fraction of retrieved chunks rose from 0.00 (iterations 1–2) to ~0.96 by iteration 10, with most questions retrieving 80–100% generated content by iteration 6 onward. Collapse onset was sudden (between iterations 2 and 3) rather than gradual.

**With control:** Mean synthetic fraction remained at 0.00 across all 10 iterations and all 15 questions — 150 data points, zero exceptions — even as generated content continued accumulating in the index in parallel.

**Drift:** Answer drift (word-overlap distance from baseline) rose only modestly (~0.28 to ~0.35) and plateaued, even as retrieval collapsed almost completely — suggesting the model's phrasing stayed relatively stable even while its source material became almost entirely self-referential. This is a nuance worth further investigation.

See `analysis/charts/` for the full visualizations, and `evidence/` for raw logs.

## Control Design

The fix does not attempt to detect AI-generated text after the fact — text-detection is known to be unreliable, which is the whole reason this collapse pattern exists. Instead, content is tagged with its provenance at write time (human vs. generated) and the retrieval layer filters on that tag. This is enforced via a Vectorize metadata index on the `provenance` field.

## Limitations

- Corpus size: 15 documents (~57K words), not the originally scoped 30 — chosen deliberately to fit available time and Workers AI's free-tier daily Neuron budget.
- Two of the 15 source documents (the largest) required splitting into two parts each to avoid Worker execution timeouts during ingestion.
- Drift is measured via a simple word-overlap metric, a proxy — not a semantic similarity measure.
- Single generation model (Llama 3.1 8B Instruct Fast), single embedding model (BGE base).
- The gen_depth-vs-iteration chart originally scoped in the plan was not produced; synthetic fraction and drift charts were prioritized given time constraints.
- All testing used Cloudflare Workers AI's free tier; a production RAG system would need this validated at larger scale.

## Future Work

- Track and chart mean gen_depth of retrieved chunks over iterations.
- Test whether down-weighting (rather than hard-excluding) generated content changes the collapse curve's shape.
- Test with a larger, more diverse corpus and longer iteration counts.
- Investigate why answer drift plateaued while retrieval fully collapsed — is the model relying on internal knowledge once retrieved context becomes unreliable?

## Reproduce

See instructions below / in README.md.
