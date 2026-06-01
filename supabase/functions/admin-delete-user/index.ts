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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error("Server configuration error: missing Supabase credentials");
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const { data: callerRole } = await anonClient
      .from("user_roles").select("role").eq("user_id", callerId).single();
    if (!callerRole || !["super_admin", "admin"].includes(callerRole.role)) {
      throw new Error("Insufficient permissions");
    }

    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");
    if (userId === callerId) throw new Error("You cannot delete your own account");

    // Privilege check: an admin (non-super) cannot delete/ban a super_admin
    if (callerRole.role !== "super_admin") {
      const { data: targetRole } = await anonClient.from("user_roles").select("role").eq("user_id", userId).single();
      if (targetRole && targetRole.role === "super_admin") {
        throw new Error("Only a super admin can delete another super admin");
      }
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check if user has any historical activity that would block hard-delete
    const [{ count: ticketsRaised }, { count: historyCount }] = await Promise.all([
      adminClient.from("tickets").select("id", { count: "exact", head: true }).eq("raised_by", userId),
      adminClient.from("ticket_history").select("id", { count: "exact", head: true }).eq("performed_by", userId),
    ]);

    const hasActivity = (ticketsRaised ?? 0) > 0 || (historyCount ?? 0) > 0;

    if (hasActivity) {
      // Soft-delete: revoke role + ban auth user. Profile is preserved for audit history.
      const { error: roleErr } = await adminClient.from("user_roles").delete().eq("user_id", userId);
      if (roleErr) throw roleErr;

      const { error: banErr } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "876600h", // ~100 years
      });
      if (banErr) throw banErr;

      return new Response(
        JSON.stringify({ success: true, mode: "deactivated", message: "User had activity history. Account access revoked and login disabled; audit records preserved." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hard-delete path: no activity, safe to remove everything
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);
    const { error: delError } = await adminClient.auth.admin.deleteUser(userId);
    if (delError) throw delError;

    return new Response(
      JSON.stringify({ success: true, mode: "deleted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
