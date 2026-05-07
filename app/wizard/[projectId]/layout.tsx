import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtTHB } from "@/lib/utils";

const STEPS = [
  { slug: "info", num: 1, label: "ข้อมูลโครงการ" },
  { slug: "milestones", num: 2, label: "งวดงาน + Gantt" },
  { slug: "boq-materials", num: 3, label: "BOQ วัสดุ" },
  { slug: "boq-labor", num: 4, label: "BOQ ค่าแรง" },
  { slug: "team", num: 5, label: "ทีมงาน" },
];

export default async function ProjectWizardLayout({
  children, params,
}: { children: React.ReactNode; params: { projectId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: proj } = await supabase
    .from("skb_projects")
    .select("id, project_code, project_name, contract_value, intake_status, start_date, end_date")
    .eq("id", params.projectId)
    .maybeSingle() as { data: { id: string; project_code: string; project_name: string; contract_value: number; intake_status: string; start_date: string | null; end_date: string | null } | null };

  if (!proj) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-soft">
        <p className="text-3xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold text-slate-800">ไม่พบโครงการ</h1>
        <p className="mt-1 text-sm text-slate-500">โครงการนี้อาจถูกลบหรือ ID ไม่ถูกต้อง</p>
        <Link href="/wizard" className="mt-4 inline-block rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white">← กลับฟอร์มหลัก</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-brand-primary">{proj.project_code}</p>
            <h1 className="text-xl font-bold text-slate-800">{proj.project_name}</h1>
            <p className="text-xs text-slate-500">มูลค่าสัญญา ฿{fmtTHB(proj.contract_value)} · {proj.start_date} → {proj.end_date}</p>
          </div>
          <Link href="/wizard" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">↩ ฟอร์มหลัก</Link>
        </div>

        {/* Step navigator */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {STEPS.map((s, i) => (
            <Link key={s.slug} href={`/wizard/${proj.id}/${s.slug}`} className="flex flex-1 items-center gap-2 transition hover:opacity-80">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">{s.num}</div>
              <span className="hidden text-xs md:inline">{s.label}</span>
              {i < STEPS.length - 1 && <div className="h-0.5 flex-1 bg-slate-100" />}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
