import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.FF_CONFIG || {};
const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const ENGINES = ["ChatGPT", "Google Gemini", "Google AI Overviews", "Perplexity", "Microsoft Copilot", "Claude", "Grok"];
const PW_DAYS = 30;

/* ---------------- helpers ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const page = document.getElementById("page");
const fmtDay = (d) => d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

function metricHTML(m, fallbackLabel) {
  if (!m) return `<span class="badge unknown">${esc(fallbackLabel || "could not verify")}</span>`;
  if (m.label === "could not verify" || m.value === null || m.value === undefined)
    return `<span class="badge unknown">could not verify</span>`;
  return `<span class="big">${esc(m.label || m.value)}</span>`;
}
function metricBig(m) {
  if (!m || m.label === "could not verify" || m.value === null || m.value === undefined)
    return `<span class="badge unknown">could not verify</span>`;
  return `<div class="big">${esc(m.label || m.value)}</div>`;
}
async function latestMetric(kind) {
  const { data } = await sb.from("metric_snapshots").select("value,label,day")
    .eq("kind", kind).order("day", { ascending: false }).limit(1);
  return data && data[0];
}
async function callFn(name, body, token) {
  const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}

/* ---------------- auth ---------------- */
async function authed() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) return true;
  try {
    const pw = JSON.parse(localStorage.getItem("ff_pw_ok") || "null");
    if (pw && Date.now() - pw.ts < PW_DAYS * 864e5) return true;
  } catch { /* ignore */ }
  return false;
}
async function emailSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}
function showLogin() {
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}
function showApp() {
  document.getElementById("view-login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

document.getElementById("btn-email-login").onclick = async () => {
  const email = document.getElementById("login-email").value.trim();
  const msg = document.getElementById("email-login-msg");
  if (!email || !email.includes("@")) { msg.className = "msg err"; msg.textContent = "Enter a valid email."; return; }
  msg.className = "msg"; msg.textContent = "Sending…";
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
  msg.className = "msg " + (error ? "err" : "ok");
  msg.textContent = error ? "Could not send the link. Try again." : "Check your email for the login link.";
};
document.getElementById("btn-password-login").onclick = async () => {
  const password = document.getElementById("login-password").value;
  const msg = document.getElementById("password-login-msg");
  msg.className = "msg"; msg.textContent = "Checking…";
  try {
    const r = await callFn("verify-owner-password", { password });
    if (r.ok) {
      localStorage.setItem("ff_pw_ok", JSON.stringify({ ts: Date.now() }));
      document.getElementById("login-password").value = "";
      showApp(); route();
    } else {
      msg.className = "msg err";
      msg.textContent = r.has_password ? "Wrong password. Try again." : "No password set yet — log in with email first, then set one in Settings.";
    }
  } catch { msg.className = "msg err"; msg.textContent = "Could not reach the server. Try again."; }
};
document.getElementById("btn-signout").onclick = async () => {
  await sb.auth.signOut();
  localStorage.removeItem("ff_pw_ok");
  location.hash = "#/home";
  showLogin();
};

/* ---------------- router ---------------- */
const ROUTES = {
  "home": viewHome,
  "seo/scoreboard": viewSeoScoreboard,
  "seo/changes": (p) => viewChanges("seo"),
  "seo/visitors": viewSeoVisitors,
  "seo/leads": viewSeoLeads,
  "seo/plan": (p) => viewPlan("seo"),
  "ai/tests": viewAiTests,
  "ai/mentions": viewAiMentions,
  "ai/changes": (p) => viewChanges("ai"),
  "ai/plan": (p) => viewPlan("ai"),
  "settings": viewSettings,
};
async function route() {
  if (!await authed()) { showLogin(); return; }
  showApp();
  const r = (location.hash || "#/home").replace("#/", "");
  const fn = ROUTES[r] || viewHome;
  document.querySelectorAll(".nav-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.route === r));
  document.getElementById("sidebar").classList.remove("open");
  page.innerHTML = `<div class="loading">Loading…</div>`;
  try { page.innerHTML = await fn(); }
  catch (e) { page.innerHTML = `<h1>Something went wrong</h1><p class="muted">Could not load the data. Try again.</p>`; }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
document.getElementById("nav-toggle").onclick = () =>
  document.getElementById("sidebar").classList.toggle("open");

/* ---------------- views ---------------- */
function card(title, bigHTML, note, target) {
  return `<div class="card tappable" data-go="${target}">
    <h3>${esc(title)}</h3>${bigHTML}<div class="note">${esc(note)}</div></div>`;
}

async function viewHome() {
  const [p1, vis, leads, sov, men] = await Promise.all([
    latestMetric("seo_page1"), latestMetric("seo_visitors_week"),
    latestMetric("seo_leads_week"), latestMetric("ai_sov"), latestMetric("ai_mentions_week"),
  ]);
  return `
    <h1>How the world finds Fiesta Fresh</h1>
    <p class="sub">Live numbers. Same scoreboards the night workers use.</p>
    <div class="eyebrow">Google</div>
    <div class="cards">
      ${card("Page 1", metricBig(p1), "searches showing Fiesta Fresh", "#/seo/scoreboard")}
      ${card("Visitors this week", metricBig(vis), "real visits to the site", "#/seo/visitors")}
      ${card("New leads", metricBig(leads), "this week", "#/seo/leads")}
    </div>
    <div class="eyebrow violet">AI answers</div>
    <div class="cards">
      ${card("AI recommends Fiesta Fresh", metricBig(sov), "buyer questions", "#/ai/mentions")}
      ${card("New mentions this week", metricBig(men), "across all engines", "#/ai/mentions")}
    </div>`;
}

async function viewSeoScoreboard() {
  const { data: queries } = await sb.from("seo_queries").select("id,query").eq("active", true).order("id");
  const { data: checks } = await sb.from("seo_rank_checks")
    .select("query_id,on_page1,checked_at,page1_domains,notes").order("checked_at", { ascending: false }).limit(1000);
  const latest = {};
  for (const c of checks || []) if (!(c.query_id in latest)) latest[c.query_id] = c;
  const n = (queries || []).filter((q) => latest[q.id] && latest[q.id].on_page1).length;
  const rows = (queries || []).map((q) => {
    const c = latest[q.id];
    const badge = !c ? `<span class="badge unknown">not checked yet</span>`
      : c.on_page1 ? `<span class="badge yes">page 1</span>` : `<span class="badge no">not on page 1</span>`;
    return `<tr><td>${esc(q.query)}</td><td>${badge}</td>
      <td class="muted">${c ? esc(fmtDay(c.checked_at)) : "—"}</td>
      <td class="muted">${c && c.page1_domains ? esc(c.page1_domains.slice(0, 3).join(", ")) : "—"}</td></tr>`;
  }).join("");
  return `<h1>SEO Scoreboard</h1>
    <p class="sub">Frozen set of ${(queries || []).length} searches. Same every week.</p>
    <div class="cards"><div class="card"><h3>On page 1</h3><div class="big">${n} of ${(queries || []).length}</div>
    <div class="note">goal: all 14</div></div></div>
    <div class="panel"><table><tr><th>Search</th><th>Fiesta Fresh</th><th>Checked</th><th>Who is page 1</th></tr>${rows}</table></div>`;
}

async function viewChanges(worker) {
  const { data } = await sb.from("experiments").select("*").eq("worker", worker).order("started_at", { ascending: false });
  const badge = (s) => s === "running" ? `<span class="badge run">running</span>`
    : s === "keep" ? `<span class="badge yes">keep</span>`
    : s === "extend" ? `<span class="badge run">extend</span>`
    : `<span class="badge no">revert</span>`;
  const rows = (data || []).map((e) => `<div class="exp">
      <h4>${esc(e.change)} ${badge(e.status)}</h4>
      <p><b>Hypothesis:</b> ${esc(e.hypothesis)}</p>
      <p class="meta">Started ${esc(fmtDay(e.started_at))}${e.verdict ? ` · Verdict ${esc(fmtDay(e.verdict_at))}: ${esc(e.verdict_notes || e.verdict)}` : ` · Check-backs: ${esc(fmtDay(e.checkback_7d))} / ${esc(fmtDay(e.checkback_14d))}`}</p>
    </div>`).join("") || `<p class="muted">No experiments logged yet.</p>`;
  const title = worker === "seo" ? "SEO Changes" : "AI Visibility Changes";
  return `<h1>${title}</h1><p class="sub">The experiment log. Every change, its hypothesis, its verdict.</p>${rows}`;
}

async function viewMetricHistory(kind, title, sub) {
  const { data } = await sb.from("metric_snapshots").select("day,value,label").eq("kind", kind).order("day", { ascending: false }).limit(60);
  const rows = (data || []).map((m) =>
    `<tr><td>${esc(fmtDay(m.day))}</td><td>${m.label === "could not verify" || m.value === null ? `<span class="badge unknown">could not verify</span>` : esc(m.label || m.value)}</td></tr>`
  ).join("") || `<tr><td colspan="2" class="muted">No data yet.</td></tr>`;
  return `<h1>${title}</h1><p class="sub">${sub}</p>
    <div class="panel"><table><tr><th>Week of</th><th>Value</th></tr>${rows}</table></div>`;
}
const viewSeoVisitors = () => viewMetricHistory("seo_visitors_week", "Visitors", "Real visits to fiestafreshcleaning.com, per week.");
const viewSeoLeads = () => viewMetricHistory("seo_leads_week", "Leads", "Real new leads per week.");

async function viewPlan(worker) {
  const [{ data: logs }, { data: exps }] = await Promise.all([
    sb.from("nightly_logs").select("day,summary").eq("worker", worker).order("day", { ascending: false }).limit(1),
    sb.from("experiments").select("change,hypothesis,started_at").eq("worker", worker).eq("status", "running").order("started_at", { ascending: false }),
  ]);
  const log = logs && logs[0];
  const focus = (exps || []).map((e) =>
    `<div class="exp"><h4>${esc(e.change)}</h4><p>${esc(e.hypothesis)}</p><p class="meta">Started ${esc(fmtDay(e.started_at))}</p></div>`
  ).join("") || `<p class="muted">No running experiments.</p>`;
  const title = worker === "seo" ? "SEO Daily Plan" : "AI Visibility Daily Plan";
  return `<h1>${title}</h1><p class="sub">${log ? `Last run ${esc(fmtDay(log.day))}: ${esc(log.summary)}` : "No runs yet."}</p>
    <div class="eyebrow">This week's focus</div>${focus}`;
}

async function viewAiTests() {
  const { data: qs } = await sb.from("ai_questions").select("id,qgroup,question").eq("active", true).order("id");
  const { data: checks } = await sb.from("ai_engine_checks")
    .select("question_id,engine,mentioned,recommended,checked_at").order("checked_at", { ascending: false }).limit(5000);
  const perQ = {};
  for (const c of checks || []) {
    perQ[c.question_id] = perQ[c.question_id] || {};
    if (!(c.engine in perQ[c.question_id])) perQ[c.question_id][c.engine] = c;
  }
  let lastGroup = "";
  let html = `<h1>AI Tests</h1><p class="sub">30 buyer questions. Tested across 7 engines every Sunday.</p>`;
  for (const q of qs || []) {
    if (q.qgroup !== lastGroup) { html += `<div class="eyebrow violet">${esc(q.qgroup)}</div>`; lastGroup = q.qgroup; }
    const engines = perQ[q.id] || {};
    const mentioned = Object.values(engines).filter((e) => e.mentioned).length;
    const tested = Object.keys(engines).length;
    const badge = tested === 0 ? `<span class="badge unknown">not tested yet</span>`
      : mentioned > 0 ? `<span class="badge yes">mentioned by ${mentioned}</span>`
      : `<span class="badge no">not mentioned</span>`;
    html += `<div class="engine-row"><div style="flex:1">${esc(q.question)}</div>${badge}</div>`;
  }
  return html;
}

async function viewAiMentions() {
  const sov = await latestMetric("ai_sov");
  const { data: checks } = await sb.from("ai_engine_checks")
    .select("question_id,engine,mentioned,recommended,beaten_by,checked_at").order("checked_at", { ascending: false }).limit(5000);
  const perEng = {};
  for (const c of checks || []) {
    perEng[c.engine] = perEng[c.engine] || {};
    if (!(c.question_id in perEng[c.engine])) perEng[c.engine][c.question_id] = c;
  }
  const rows = ENGINES.map((eng) => {
    const qs = perEng[eng] || {};
    const n = Object.keys(qs).length;
    const m = Object.values(qs).filter((c) => c.mentioned).length;
    const r = Object.values(qs).filter((c) => c.recommended).length;
    const pct = n ? Math.round((m / n) * 100) : 0;
    const status = n === 0 ? `<span class="badge unknown">could not verify</span>`
      : `<span class="${m ? "badge yes" : "badge no"}">${m} of ${n} mention it</span>`;
    return `<div class="engine-row"><div class="name">${esc(eng)}</div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="small muted" style="width:150px">${status}${r ? ` · ⭐ ${r} recommend` : ""}</div></div>`;
  }).join("");
  return `<h1>AI Mentions</h1><p class="sub">Share of voice: how many answers mention Fiesta Fresh, per engine.</p>
    <div class="cards"><div class="card"><h3>Share of voice</h3>${metricBig(sov)}<div class="note">of 30 buyer questions</div></div></div>
    <div class="panel">${rows}</div>
    <p class="muted small">An engine that cannot be checked stays "could not verify" — never guessed.</p>`;
}

async function viewSettings() {
  const session = await emailSession();
  let hasPw = false;
  try { hasPw = (await callFn("verify-owner-password", { password: "" })).has_password; } catch { /* ignore */ }
  return `<h1>Settings</h1><p class="sub">Owner controls.</p>
    <div class="panel">
      <h3 style="margin-top:0;color:var(--ink)">Phone password</h3>
      <p class="muted small">Status: ${hasPw ? "set ✓" : "not set yet"}. ${session ? "You are logged in with email, so you can set it below." : "Log in with email first, then set your password here."}</p>
      <div class="row">
        <input id="set-pw" type="password" placeholder="New password (6+ characters)" ${session ? "" : "disabled"}>
        <button id="btn-set-pw" class="btn primary" ${session ? "" : "disabled"}>Set password</button>
      </div>
      <p id="set-pw-msg" class="msg"></p>
      <p class="muted small">Only a salted hash is stored. The password itself is never saved or shown.</p>
    </div>
    <div class="panel">
      <h3 style="margin-top:0;color:var(--ink)">About this dashboard</h3>
      <p class="muted small">Numbers come from the night workers' database rows. The app only reads — nothing here is hand-edited. "Could not verify" means unknown, never zero.</p>
    </div>`;
}

/* settings form wiring (delegated, since the view re-renders) */
document.addEventListener("click", async (e) => {
  if (e.target.id === "btn-set-pw") {
    const pw = document.getElementById("set-pw").value;
    const msg = document.getElementById("set-pw-msg");
    const session = await emailSession();
    if (!session) { msg.className = "msg err"; msg.textContent = "Log in with email first."; return; }
    msg.className = "msg"; msg.textContent = "Saving…";
    try {
      const r = await callFn("set-owner-password", { password: pw }, session.access_token);
      msg.className = "msg " + (r.ok ? "ok" : "err");
      msg.textContent = r.ok ? "Password set. Use it on your phone from now on." : ("Could not save: " + (r.error || "try again"));
      if (r.ok) document.getElementById("set-pw").value = "";
    } catch { msg.className = "msg err"; msg.textContent = "Could not reach the server."; }
  }
  const go = e.target.closest("[data-go]");
  if (go) location.hash = go.dataset.go;
});

/* ---------------- boot ---------------- */
if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("__PROJECT_REF__")) {
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("view-login").innerHTML =
    `<div class="login-card"><h1>Not connected yet</h1><p class="muted">The dashboard is being set up. Check back soon.</p></div>`;
} else {
  sb.auth.onAuthStateChange(() => route());
  route();
}
