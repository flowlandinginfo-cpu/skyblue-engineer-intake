import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-primary via-brand-primary-light to-cyan-700 px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-soft sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white text-2xl">
            🏗️
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sky Blue Construction</h1>
            <p className="text-sm text-slate-500">Engineer Intake System · Phase 1 MVP</p>
          </div>
        </div>

        <div className="mb-6 space-y-3 text-sm text-slate-700">
          <p>
            ระบบบันทึกข้อมูลโครงการก่อสร้างสำหรับวิศวกร — เก็บข้อมูล Project Info,
            งวดงาน + Gantt, BOQ วัสดุ, BOQ ค่าแรง, ทีมงานหน้างาน
          </p>
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            ✅ Database schema deployed — v1.5–v1.11 patches applied · Codex green light for scaffold
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/sign-in"
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-dark"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/sign-up"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            สมัครสมาชิก
          </Link>
        </div>

        <div className="mt-6 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          🚧 Scaffold v0.1 — UI components ของ wizard กำลังจะ port จาก HTML preview v6 ในรอบถัดไป
        </div>
      </div>
    </main>
  );
}
