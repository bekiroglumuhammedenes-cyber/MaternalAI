import { corsHeaders, embed, json, rpc, verifyTurnstile } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    if (typeof body.website === "string" && body.website) return json({ ok: true });
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (question.length < 5 || question.length > 1000) return json({ error: "Question length is invalid" }, 400);
    if (!(await verifyTurnstile(typeof body.turnstileToken === "string" ? body.turnstileToken : ""))) return json({ error: "Spam doğrulaması başarısız" }, 400);
    const embedding = await embed(question);
    await rpc("submit_question", { p_text: question, p_embedding: JSON.stringify(embedding) });
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("ask failed", error);
    return json({ error: "Question could not be saved" }, 500);
  }
});
