import { redirect } from "next/navigation";

/**
 * Phase 1.x — root redirects to the static HTML preview that lives in
 * /public/intake.html. This is the same UI Boss tested locally (v6).
 *
 * Next iteration (Stage 7.3) will replace this with a real React-based
 * sign-in page wired to Supabase Auth and live data.
 */
export default function Home() {
  redirect("/intake.html");
}
