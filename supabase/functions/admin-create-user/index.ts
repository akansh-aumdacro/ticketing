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

    const { email, password, name, username, employeeId, contact, role, departmentId, unitId } = await req.json();

    if (!unitId || unitId === "none") {
      throw new Error("Please select a unit");
    }

    // Privilege check: only super_admin can create super_admin or admin users
    if (role && ["super_admin", "admin"].includes(role) && callerRole.role !== "super_admin") {
      throw new Error("Only a super admin can assign admin or super admin roles");
    }

    // Use service role to create user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username, employee_id: employeeId, contact },
    });
    if (createError) throw createError;

    const userId = newUser.user.id;

    // Update role if not default 'user'
    if (role && role !== "user") {
      await adminClient.from("user_roles").update({ role }).eq("user_id", userId);
    }

    // Update profile (department + unit)
    const profileUpdates: Record<string, unknown> = { unit_id: unitId };
    if (departmentId && departmentId !== "none") {
      profileUpdates.department_id = departmentId;
    }
    await adminClient.from("profiles").update(profileUpdates).eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
