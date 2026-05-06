import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root: auth-aware redirect.
 * - Logged in → /wizard
 * - Not logged in → /sign-in
 *
 * Note: /intake.html (static v6 preview) is still accessible directly
 * for legacy testing — middleware skips it.
 */
export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/wizard" : "/sign-in");
}
