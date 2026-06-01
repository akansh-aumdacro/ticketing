import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const { data: callerRole } = await anonClient.from("user_roles").select("role").eq("user_id", callerId).single();
    if (!callerRole || !["super_admin", "admin"].includes(callerRole.role)) {
      throw new Error("Insufficient permissions");
    }

    const { userId, email, password } = await req.json();
    if (!userId) throw new Error("userId required");

    // Privilege check: an admin (non-super) cannot modify another super_admin's credentials
    if (callerRole.role !== "super_admin" && userId !== callerId) {
      const { data: targetRole } = await anonClient.from("user_roles").select("role").eq("user_id", userId).single();
      if (targetRole && targetRole.role === "super_admin") {
        throw new Error("Only a super admin can modify another super admin's credentials");
      }
    }

    const updates: Record<string, unknown> = {};
    if (email && email.trim()) updates.email = email.trim();
    if (password && password.length > 0) {
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      updates.password = password;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updates);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
