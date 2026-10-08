// verify-owner-password: checks the phone password without ever exposing the hash.
// POST {"password": "..."} -> {"ok": true/false, "has_password": true/false}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { password } = await req.json();
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await sb.from("owner_secret").select("salt, hash").limit(1).maybeSingle();
    if (!data) {
      return Response.json({ ok: false, has_password: false }, { headers: cors });
    }
    if (typeof password !== "string" || password.length === 0 || password.length > 200) {
      return Response.json({ ok: false, has_password: true }, { headers: cors });
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data.salt + password)
    );
    const attempt = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const a = hexToBytes(attempt);
    const b = hexToBytes(data.hash);
    let diff = a.length ^ b.length;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) diff |= a[i] ^ b[i];
    const ok = diff === 0;
    return Response.json({ ok, has_password: true }, { headers: cors });
  } catch {
    return Response.json({ ok: false, has_password: false }, { headers: cors });
  }
});
