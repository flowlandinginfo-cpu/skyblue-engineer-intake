import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_NAV = [
  { href: "/admin/employees", label: "พนักงาน", icon: "👥" },
  { href: "/admin/projects", label: "โครงการ", icon: "🏗️" },
  { href: "/admin/companies", label: "บริษัท", icon: "🏢" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: emp } = await supabase
    .from("employees")
    .select("full_name, role_code, is_approved")
    .eq("auth_user_id", user.id)
    .maybeSingle() as { data: { full_name?: string; role_code?: string; is_approved?: boolean } | null };

  const isAdmin = emp?.role_code === "manager" || emp?.role_code === "owner" || emp?.role_code === "admin" || emp?.role_code === "ceo";

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-soft">
          <p className="mb-3 text-3xl">🚫</p>
          <h1 className="mb-2 text-xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="mb-6 text-sm text-slate-500">หน้านี้สำหรับ Admin / Manager / Owner เท่านั้น<br/>(บัญชีของคุณคือ <code className="rounded bg-slate-100 px-1">{emp?.role_code || "engineer"}</code>)</p>
          <Link href="/wizard" className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark">← กลับไปฟอร์มกรอกโครงการ</Link>
        </div>
      </div>
    );
  }

  const initial = (emp?.full_name || user.email || "?").slice(0, 1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 bg-white shadow-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/wizard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white text-xl">🏗️</div>
            <div>
              <h1 className="text-base font-semibold text-slate-800">Sky Blue · Admin</h1>
              <p className="text-xs text-slate-500">จัดการพนักงาน + โครงการ</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">{initial}</div>
            <div>
              <p className="text-xs font-semibold text-slate-700">{emp?.full_name}</p>
              <p className="text-[10px] text-slate-500">{emp?.role_code}</p>
            </div>
            <form action="/auth/sign-out" method="post"><button type="submit" className="ml-2 rounded p-1 text-slate-400 hover:text-brand-danger">⎋</button></form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl gap-6 px-6 py-6">
        <aside className="w-60 flex-shrink-0">
          <nav className="sticky top-24 space-y-1 rounded-2xl bg-white p-3 shadow-soft">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</p>
            {ADMIN_NAV.map(it => (
              <Link key={it.href} href={it.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                <span>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            ))}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <Link href="/wizard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
                <span>↩️</span>
                <span>กลับฟอร์ม</span>
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
