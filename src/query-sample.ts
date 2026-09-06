// src/query-sample.ts
// Sample query endpoint to verify chunks are stored with correct provenance metadata

interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "What is a firewall?";

    // Embed the query
    const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [query],
    });
    const vector = embeddingResponse.data[0];

    // Query Vectorize, returning top 5 matches with metadata
    const results = await env.VECTORIZE.query(vector, {
      topK: 5,
      returnMetadata: true,
    });

    return new Response(JSON.stringify({ query, results }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
