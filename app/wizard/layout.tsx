import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WizardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Pull employee row to show name + role
  const { data: emp } = await supabase
    .from("employees")
    .select("full_name, role_code, company_id, is_approved")
    .eq("auth_user_id", user.id)
    .maybeSingle() as { data: { full_name?: string; role_code?: string; company_id?: string; is_approved?: boolean } | null };

  const initial = (emp?.full_name || user.email || "?").slice(0, 1);
  const isAdmin = emp?.role_code === "manager" || emp?.role_code === "owner" || emp?.role_code === "admin";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-white shadow-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/wizard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white text-xl">🏗️</div>
            <div>
              <h1 className="text-base font-semibold text-slate-800">Sky Blue Construction</h1>
              <p className="text-xs text-slate-500">Engineer Intake System</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/wizard" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">📝 ฟอร์มกรอกโครงการ</Link>
            {isAdmin && (
              <Link href="/admin/employees" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">⚙️ Admin</Link>
            )}
            <div className="ml-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">{initial}</div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-700">{emp?.full_name || user.email}</p>
                <p className="text-[10px] text-slate-500">{emp?.role_code || "engineer"} · {emp?.company_id || "—"}</p>
              </div>
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="ml-2 rounded p-1 text-slate-400 hover:text-brand-danger" title="ออกจากระบบ">⎋</button>
              </form>
            </div>
          </nav>
        </div>
      </header>

      {!emp?.is_approved && (
        <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-800">
          ⚠️ บัญชีรอ admin อนุมัติ — ฟอร์มอาจ submit ไม่สำเร็จจนกว่าจะได้รับอนุมัติ
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
