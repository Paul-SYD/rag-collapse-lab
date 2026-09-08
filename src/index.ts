// src/index.ts
// Combined Worker: routes to /ask and /ingest based on path

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

async function handleIngest(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    files: { name: string; content: string; provenance?: string; gen_depth?: number }[];
  };
  const results: string[] = [];
  let totalChunks = 0;

  for (const file of body.files) {
    const chunks = chunkText(file.content);
    for (let i = 0; i < chunks.length; i++) {
      const chunkT = chunks[i];
      const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [chunkT] });
      const vector = embeddingResponse.data[0];

      const metadata: ProvenanceMetadata = {
        source: file.name,
        provenance: (file.provenance as "human" | "generated") || "human",
        gen_depth: file.gen_depth ?? 0,
        ingested_at: new Date().toISOString(),
        chunk_index: i,
        text: chunkT,
      };

      const id = `${file.name}-chunk-${i}`;
      await env.VECTORIZE.upsert([{ id, values: vector, metadata }]);
      totalChunks++;
    }
    results.push(`${file.name}: ${chunks.length} chunks`);
  }

  return new Response(JSON.stringify({ status: "done", totalChunks, files: results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleAsk(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const question = url.searchParams.get("q");
  if (!question) {
    return new Response(JSON.stringify({ error: "Missing ?q= parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [question] });
  const vector = embeddingResponse.data[0];

  const results = await env.VECTORIZE.query(vector, { topK: 5, returnMetadata: true });

  const contextChunks = results.matches.map((m: any) => m.metadata.text);
  const context = contextChunks.join("\n\n---\n\n");

  const prompt = `Answer the question using ONLY the context below. If the context doesn't contain the answer, say so.

Context:
${context}

Question: ${question}

Answer:`;

  const generationResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [{ role: "user", content: prompt }],
  });

  const answer = generationResponse.response;

  const sourcesUsed = results.matches.map((m: any) => ({
    id: m.id,
    score: m.score,
    source: m.metadata.source,
    provenance: m.metadata.provenance,
    gen_depth: m.metadata.gen_depth,
  }));

  return new Response(JSON.stringify({ question, answer, sources_used: sourcesUsed }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ingest") return handleIngest(request, env);
    if (url.pathname === "/ask") return handleAsk(request, env);
    return new Response("Use /ask?q=... or POST /ingest", { status: 404 });
  },
};
