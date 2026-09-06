// src/ingest.ts
// Reads all corpus files, chunks them, embeds via Workers AI, and stores in Vectorize
// Run via: npx wrangler dev --remote src/ingest.ts  (or as a scheduled/manual trigger)

interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

interface ProvenanceMetadata {
  source: string;
  provenance: "human" | "generated";
  gen_depth: number;
  ingested_at: string;
  chunk_index: number;
  text: string;
}

// Simple chunking: split by paragraphs, then group into ~500-character chunks
function chunkText(text: string, maxChunkSize = 500): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ingest") {
      return new Response("Use POST /ingest with corpus files in the request body", { status: 404 });
    }

    const body = await request.json() as { files: { name: string; content: string }[] };
    const results: string[] = [];
    let totalChunks = 0;

    for (const file of body.files) {
      const chunks = chunkText(file.content);

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];

        // Embed via Workers AI BGE model
        const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
          text: [chunkText],
        });
        const vector = embeddingResponse.data[0];

        const metadata: ProvenanceMetadata = {
          source: file.name,
          provenance: "human",
          gen_depth: 0,
          ingested_at: new Date().toISOString(),
          chunk_index: i,
          text: chunkText,
        };

        const id = `${file.name}-chunk-${i}`;

        await env.VECTORIZE.upsert([
          {
            id,
            values: vector,
            metadata,
          },
        ]);

        totalChunks++;
      }

      results.push(`${file.name}: ${chunks.length} chunks`);
    }

    return new Response(
      JSON.stringify({ status: "done", totalChunks, files: results }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
