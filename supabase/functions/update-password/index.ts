import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UpdatePasswordRequest {
  current_password?: string;
  new_password: string;
  is_first_password: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user's token to get current user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client to update password
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { current_password, new_password, is_first_password }: UpdatePasswordRequest = await req.json();

    // Validate new password
    if (!new_password || new_password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check password strength
    const hasUppercase = /[A-Z]/.test(new_password);
    const hasLowercase = /[a-z]/.test(new_password);
    const hasNumber = /[0-9]/.test(new_password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Password must contain uppercase, lowercase, and a number" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's profile to check auth method
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("oauth_provider, registered_from, has_password_set")
      .eq("id", user.id)
      .single();

    // Determine if this is first password based on profile data
    const isOAuthUser = profile?.oauth_provider && 
      ["Google", "Email OTP", "Wallet"].includes(profile.oauth_provider);
    const hasExistingPassword = profile?.has_password_set === true || 
      profile?.registered_from === "fun_profile_classic";

    // If not first password, verify current password
    if (!is_first_password && hasExistingPassword) {
      if (!current_password) {
        return new Response(
          JSON.stringify({ success: false, error: "Current password required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to sign in with current password to verify it
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: user.email!,
        password: current_password,
      });

      if (signInError) {
        return new Response(
          JSON.stringify({ success: false, error: "Current password is incorrect" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    );

    if (updateError) {
      console.error("[update-password] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile to mark has_password_set
    await supabaseAdmin
      .from("profiles")
      .update({ 
        has_password_set: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    // Log the action for audit
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        admin_id: user.id,
        action: is_first_password ? "SET_FIRST_PASSWORD" : "CHANGE_PASSWORD",
        target_user_id: user.id,
        reason: is_first_password ? "User set password for the first time" : "User changed password",
      });

    console.log(`[update-password] Password ${is_first_password ? "set" : "changed"} for user:`, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: is_first_password ? "Password created successfully" : "Password changed successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[update-password] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
