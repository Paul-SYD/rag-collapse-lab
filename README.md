# rag-collapse-lab

## Hypothesis

RAG (Retrieval-Augmented Generation) systems that lack provenance tracking can suffer a degradation pattern sometimes called "RAG collapse" - where the system's own generated outputs get re-indexed and retrieved as if they were original source material. Over repeated cycles, this can cause answer quality to drift and synthetic content to compound, similar to model collapse in generative training.

This project reproduces that failure mode in a small, controlled RAG system, measures it quantitatively, and implements a provenance-based control that stops it, then proves the control works with a before/after comparison.

**One-sentence pitch:** I saw this break in production, so i built a lab to reproduce it, quantify it, and design the control that stops it.

## Status

In progress - M0 complete (scaffold deployed).

Live endpoint: https://rag-collapse-lab.paulyohanna.workers.dev

## Non-goals

- Not trying to detect AI-generated text after the fact (unreliable - that's the point; this project tags provenance at write time instead).
- Not a production system. Toy corpus (~15 docs), small models, free tier only.
- Not claiming novelity over the 2026 "RAG collapse" literature - this is an independent small-scale replication + control demo, with citations.
 
