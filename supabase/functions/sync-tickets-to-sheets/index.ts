// Sync all tickets from Supabase to Google Sheets using a service account.
// Auth: Google service account JWT -> OAuth2 access token -> Sheets API v4.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HEADERS = [
  "Ticket ID",
  "Issue / Title",
  "Department",
  "Plant / Unit",
  "Raised By",
  "Assigned Technician",
  "Status",
  "Priority",
  "Target Date",
  "Created Date",
  "Closed Date",
  "Aging (Days)",
  "Feedback Rating",
  "Feedback Comment",
  "Last Synced",
];

const SYNC_TAB_NAME = "Tickets Sync";
const EMPTY_ROW = Array.from({ length: HEADERS.length }, () => "");

// ---------- Google Auth (service account JWT -> access token) ----------

function base64UrlEncode(bytes: Uint8Array): string {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  // Handle: literal \n escapes, surrounding quotes, CRLF, missing headers,
  // and any whitespace inside the base64 body.
  let s = pem.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  s = s.replace(/\\n/g, "\n").replace(/\\r/g, "");
  const b64 = s
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!b64) throw new Error("GOOGLE_PRIVATE_KEY is empty after parsing");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
  const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")!;
  if (!privateKey || privateKey.length < 500) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY looks invalid (too short). Paste the full key from the service account JSON, including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines.",
    );
  }
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64UrlEncodeString(JSON.stringify(header));
  const claimB64 = base64UrlEncodeString(JSON.stringify(claim));
  const toSign = `${headerB64}.${claimB64}`;

  const keyData = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(toSign),
  );
  const jwt = `${toSign}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google auth failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

// ---------- Sheet helpers ----------

async function ensureSyncSheet(
  sheetId: string,
  token: string,
): Promise<string> {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Sheet metadata failed: ${r.status} ${t}`);
  }
  const json = await r.json();
  const existing = json.sheets?.find(
    (sheet: { properties?: { title?: string } }) =>
      sheet.properties?.title === SYNC_TAB_NAME,
  );
  if (existing) return SYNC_TAB_NAME;

  const createRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: SYNC_TAB_NAME } } }],
      }),
    },
  );
  if (!createRes.ok) {
    const t = await createRes.text();
    throw new Error(`Create sync tab failed: ${createRes.status} ${t}`);
  }
  return SYNC_TAB_NAME;
}

async function writeSheet(
  sheetId: string,
  token: string,
  tabName: string,
  rows: string[][],
) {
  // Avoid full-sheet clear operations because protected cells/objects on other
  // tabs can block them. Instead, overwrite only this sync tab's ticket range.
  const rangeBase = `${encodeURIComponent(tabName)}!A1:O`;
  const existingRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeBase}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!existingRes.ok) {
    const t = await existingRes.text();
    throw new Error(`Read existing sync range failed: ${existingRes.status} ${t}`);
  }
  const existing = await existingRes.json();
  const existingRowCount = Array.isArray(existing.values) ? existing.values.length : 0;
  const writeRows = rows.slice();
  while (writeRows.length < existingRowCount) writeRows.push(EMPTY_ROW);

  const writeUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeBase}${writeRows.length}?valueInputOption=USER_ENTERED`;
  const writeRes = await fetch(writeUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: writeRows }),
  });
  if (!writeRes.ok) {
    const t = await writeRes.text();
    throw new Error(`Write failed: ${writeRes.status} ${t}`);
  }
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- Authentication ----
    // Accept either: (a) a service-role bearer token (DB trigger), or
    //                (b) a JWT belonging to an admin/super_admin user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    let authorized = false;
    if (token && token === serviceKey) {
      authorized = true;
    } else {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData } = await anonClient.auth.getClaims(token);
      const callerId = claimsData?.claims?.sub;
      if (callerId) {
        const { data: callerRole } = await anonClient
          .from("user_roles").select("role").eq("user_id", callerId).single();
        if (callerRole && ["super_admin", "admin"].includes(callerRole.role)) {
          authorized = true;
        }
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sheetId = Deno.env.get("GOOGLE_SHEET_ID")!;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all tickets + relations
    const { data: tickets, error: tErr } = await supabase
      .from("tickets")
      .select(
        "id, ticket_number, title, status, priority, target_date, created_at, closed_at, raised_by, assigned_to, issue_department_id, unit_id",
      )
      .order("created_at", { ascending: false });
    if (tErr) throw tErr;

    const [{ data: profiles }, { data: depts }, { data: units }, { data: ratings }] =
      await Promise.all([
        supabase.from("profiles").select("user_id, name"),
        supabase.from("departments").select("id, name"),
        supabase.from("units").select("id, name"),
        supabase.from("ticket_ratings").select("ticket_id, rating, feedback"),
      ]);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.name]));
    const deptMap = new Map((depts || []).map((d) => [d.id, d.name]));
    const unitMap = new Map((units || []).map((u) => [u.id, u.name]));
    const ratingMap = new Map(
      (ratings || []).map((r) => [r.ticket_id, { rating: r.rating, feedback: r.feedback }]),
    );

    const now = new Date();
    const syncedAt = now.toISOString();

    const fmtDate = (s: string | null) =>
      s ? new Date(s).toISOString().slice(0, 10) : "";

    const rows: string[][] = [HEADERS];
    for (const t of tickets || []) {
      const created = new Date(t.created_at);
      const endDate = t.closed_at ? new Date(t.closed_at) : now;
      const aging = Math.max(
        0,
        Math.floor((endDate.getTime() - created.getTime()) / 86400000),
      );
      const r = ratingMap.get(t.id);
      rows.push([
        t.ticket_number || t.id,
        t.title || "",
        deptMap.get(t.issue_department_id || "") || "",
        unitMap.get(t.unit_id || "") || "",
        profileMap.get(t.raised_by) || "",
        t.assigned_to ? profileMap.get(t.assigned_to) || "" : "",
        t.status || "",
        t.priority || "",
        fmtDate(t.target_date),
        fmtDate(t.created_at),
        fmtDate(t.closed_at),
        String(aging),
        r ? String(r.rating) : "",
        r?.feedback || "",
        syncedAt,
      ]);
    }

    const token = await getGoogleAccessToken();
    const tab = await ensureSyncSheet(sheetId, token);
    await writeSheet(sheetId, token, tab, rows);

    return new Response(
      JSON.stringify({ success: true, rowCount: rows.length - 1, syncedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-tickets-to-sheets error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    let code = 500;
    if (/401|403|auth/i.test(msg)) code = 401;
    else if (/404|not found/i.test(msg)) code = 404;
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: code, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
