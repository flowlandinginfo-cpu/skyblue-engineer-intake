import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback — runs after:
 *  - Sign-up email confirmation (Supabase emails confirmation link → here)
 *  - Magic-link sign-in (link in email → here)
 *  - Auto-confirm sign-up (when Confirm email is disabled, sign-up redirects here directly)
 *  - OAuth providers (future)
 *
 * Steps:
 *  1. If `?code` present → exchange code for active session.
 *     Otherwise (auto-confirm path) → use existing session.
 *  2. Idempotent ensure-employees-row from auth user_metadata.
 *  3. Redirect to ?next or /wizard.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/wizard";

  const supabase = createClient();

  // 1. Exchange code if present (real Supabase code, not the "skip" sentinel)
  if (code && code !== "skip") {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) {
      return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(exErr.message)}`);
    }
  }

  // 2. Get authenticated user (either from exchange or existing session)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/sign-in?error=no_session`);
  }

  // 3. Idempotent — only insert employees if missing
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const meta = (user.user_metadata || {}) as {
      full_name?: string; phone?: string; line_id?: string; role_label?: string;
    };
    const name = meta.full_name || user.email || "ผู้ใช้ใหม่";
    const role = meta.role_label === "site_manager" ? "manager"
              : meta.role_label === "foreman" ? "foreman"
              : "engineer";

    const { error: empErr } = await supabase.from("employees").insert({
      company_id: "SKY001",
      full_name: name,
      first_name: name.split(" ")[0] || name,
      last_name: name.split(" ").slice(1).join(" ") || "",
      nickname: name,
      role_code: role,
      auth_user_id: user.id,
      hr_verified: false,
      first_login_completed: false,
      is_approved: false,
    });

    if (empErr) {
      // Do NOT block — admin can fix manually
      console.error("[auth/callback] employees insert failed:", empErr.message);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
