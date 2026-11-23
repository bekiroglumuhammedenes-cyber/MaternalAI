export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-presenter-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}

export async function embed(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!response.ok) throw new Error("Embedding service unavailable");
  const payload = await response.json();
  return payload.data[0].embedding;
}

export function supabaseHeaders() {
  const secretKeys = env("SUPABASE_SECRET_KEYS");
  let key: string;
  try {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    key = parsed.default || Object.values(parsed)[0] || "";
  } catch {
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  }
  if (!key) throw new Error("No Supabase secret API key is configured");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function verifyPresenter(request: Request): Promise<boolean> {
  const expected = env("PRESENTER_PASSWORD");
  const supplied = request.headers.get("x-presenter-key") || "";
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(supplied)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0 && supplied.length > 0;
}

export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false;
  const form = new FormData();
  form.set("secret", env("TURNSTILE_SECRET_KEY"));
  form.set("response", token);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

export async function rpc(name: string, args: Record<string, unknown>) {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST", headers: supabaseHeaders(), body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`Database request failed: ${name}`);
  return response.json();
}
