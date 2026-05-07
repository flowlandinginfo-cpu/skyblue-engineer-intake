import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtTHB } from "@/lib/utils";

export default async function ProjectInfoView({ params }: { params: { projectId: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("skb_projects")
    .select("*, project_manager:project_manager_id(full_name), site_manager:site_manager_id(full_name)")
    .eq("id", params.projectId)
    .maybeSingle() as { data: Record<string, unknown> | null };

  if (!p) return <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-soft">ไม่พบโครงการ</p>;

  const sm = (p.site_manager as { full_name?: string } | null)?.full_name;
  const pm = (p.project_manager as { full_name?: string } | null)?.full_name;

  const Item = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">📋 ข้อมูลโครงการ (Step 1)</h2>
          <Link href={`/wizard/${params.projectId}/milestones`} className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark">ไปต่อ Step 2 →</Link>
        </div>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Item label="ชื่อโครงการ" value={p.project_name as string} />
          <Item label="ประเภท" value={p.project_type as string} />
          <Item label="ลูกค้า" value={p.client_name as string} />
          <Item label="เลขที่สัญญา" value={p.contract_no as string} />
          <Item label="มูลค่าสัญญา" value={`฿${fmtTHB(p.contract_value as number)}`} />
          <Item label="ประมาณการงบ" value={p.budget_estimate ? `฿${fmtTHB(p.budget_estimate as number)}` : null} />
          <Item label="วันเริ่ม" value={p.start_date as string} />
          <Item label="วันสิ้นสุด" value={p.end_date as string} />
          <Item label="Deadline กรอก intake" value={p.intake_deadline as string} />
          <Item label="Site Manager" value={sm} />
          <Item label="วิศวกรผู้รับผิดชอบ" value={pm} />
          <Item label="สถานะ Intake" value={p.intake_status as string} />
          <Item label="พิกัด GPS" value={p.location_lat ? `${p.location_lat}, ${p.location_lng}` : null} />
          <div className="md:col-span-3">
            <dt className="text-xs text-slate-500">ที่อยู่</dt>
            <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{(p.location_address as string) || "—"}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
        💡 ตอนนี้แสดง read-only — แก้ไข field โดยตรงจะเพิ่มใน 7.3.B.2 รอบหน้า
      </div>
    </div>
  );
}
