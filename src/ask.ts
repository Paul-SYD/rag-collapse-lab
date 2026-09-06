// src/ask.ts
// RAG endpoint: retrieve relevant chunks, generate an answer, log provenance of sources used

interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ask") {
      return new Response("Use GET /ask?q=your+question", { status: 404 });
    }

    const question = url.searchParams.get("q");
    if (!question) {
      return new Response(JSON.stringify({ error: "Missing ?q= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Embed the question
    const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [question],
    });
    const vector = embeddingResponse.data[0];

    // Retrieve top-k chunks (k=5)
    const results = await env.VECTORIZE.query(vector, {
      topK: 5,
      returnMetadata: true,
    });

    // Build context from retrieved chunks
    const contextChunks = results.matches.map((m: any) => m.metadata.text);
    const context = contextChunks.join("\n\n---\n\n");

    // Generate an answer using the retrieved context
    const prompt = `Answer the question using ONLY the context below. If the context doesn't contain the answer, say so.

Context:
${context}

Question: ${question}

Answer:`;

    const generationResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [{ role: "user", content: prompt }],
    });

    const answer = generationResponse.response;

    // Log provenance of sources used — this is the key evidence artifact
    const sourcesUsed = results.matches.map((m: any) => ({
      id: m.id,
      score: m.score,
      source: m.metadata.source,
      provenance: m.metadata.provenance,
      gen_depth: m.metadata.gen_depth,
    }));

    return new Response(
      JSON.stringify(
        {
          question,
          answer,
          sources_used: sourcesUsed,
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
