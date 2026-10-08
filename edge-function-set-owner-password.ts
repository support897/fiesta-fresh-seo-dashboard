// set-owner-password: the owner sets (or resets) their phone password inside the app.
// Requires a valid Supabase Auth session (email login). POST {"password": "..."}.
// Stores ONLY salt + SHA-256(salt + password). The password itself is never stored.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    // The caller must be logged in via email: verify their JWT.
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return Response.json({ ok: false, error: "login required" }, { headers: cors });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ ok: false, error: "login required" }, { headers: cors });

    const { password } = await req.json();
    if (typeof password !== "string" || password.length < 6 || password.length > 200) {
      return Response.json({ ok: false, error: "password must be 6+ characters" }, { headers: cors });
    }
    const salt = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(salt + password)
    );
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("owner_secret").upsert({ id: 1, salt, hash });
    if (error) return Response.json({ ok: false, error: "save failed" }, { headers: cors });
    return Response.json({ ok: true }, { headers: cors });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { headers: cors });
  }
});
