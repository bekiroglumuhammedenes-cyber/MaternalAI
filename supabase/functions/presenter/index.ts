import { corsHeaders, json, rpc, verifyPresenter } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    if (!(await verifyPresenter(request))) return json({ error: "Unauthorized" }, 401);
    return json({ questions: await rpc("presenter_questions", {}) });
  } catch (error) {
    console.error("presenter failed", error);
    return json({ error: "Questions could not be loaded" }, 500);
  }
});
