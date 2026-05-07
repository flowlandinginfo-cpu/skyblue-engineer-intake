"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import ExcelPasteModal from "@/components/ExcelPasteModal";

interface PersonnelRow {
  id: string;
  isNew?: boolean;
  full_name: string;
  role_label: string;
  phone: string;
  line_id: string;
  start_date: string | null;
  report_to: string;
  notes: string;
}

// DB CHECK constraint allows only: engineer | foreman | skilled_worker | worker | other
// Show 5 Thai labels mapped 1:1 to DB codes.
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "engineer", label: "วิศวกร / หัวหน้าไซต์" },
  { value: "foreman", label: "โฟร์แมน" },
  { value: "skilled_worker", label: "ช่างฝีมือ (เหล็ก/ไม้/ปูน/ไฟฟ้า/ประปา/สี ฯลฯ)" },
  { value: "worker", label: "กรรมกร" },
  { value: "other", label: "อื่นๆ (จป., เสมียน, รปภ.)" },
];

// Map free-text Thai label (from Excel paste) → DB code
function mapRoleToCode(input: string): string {
  const v = (input || "").trim().toLowerCase();
  if (!v) return "worker";
  if (ROLE_OPTIONS.some(o => o.value === v)) return v;
  if (v.includes("วิศว") || v.includes("หัวหน้าไซต์") || v.includes("engineer")) return "engineer";
  if (v.includes("โฟร์แมน") || v.includes("foreman")) return "foreman";
  if (v.includes("ช่าง") || v.includes("skilled")) return "skilled_worker";
  if (v.includes("กรรมกร") || v.includes("worker")) return "worker";
  return "other";
}

const PASTE_COLUMNS = [
  { key: "full_name", label: "ชื่อ-นามสกุล", type: "text" as const },
  { key: "role_label", label: "ตำแหน่ง", type: "text" as const },
  { key: "phone", label: "เบอร์", type: "text" as const },
  { key: "line_id", label: "LINE ID", type: "text" as const },
  { key: "start_date", label: "วันเริ่ม (YYYY-MM-DD)", type: "text" as const },
];

const EXAMPLE = "สมชาย ใจดี\tหัวหน้าไซต์\t0812345678\tsomchai_dee\t2026-05-10\nสมหญิง รักงาน\tโฟร์แมน\t0823456789\tsomying\t2026-05-10";

export default function TeamPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const supabase = createClient();

  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [readiness, setReadiness] = useState({
    project: false,
    milestones: 0,
    materials: 0,
    labor: 0,
    personnel: 0,
    intake_status: "draft" as string,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: proj }, { data: people }, { count: cMs }, { count: cMat }, { count: cLab }] = await Promise.all([
      supabase.from("skb_projects").select("intake_status, project_name").eq("id", projectId).maybeSingle(),
      supabase.from("skb_site_personnel").select("id, full_name, role_label, phone, line_id, start_date, report_to, notes").eq("project_id", projectId).order("created_at"),
      supabase.from("skb_project_milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("skb_boq_materials").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("skb_boq_labor").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    ]);

    const peopleRows: PersonnelRow[] = ((people as PersonnelRow[]) || []).map(p => ({
      ...p,
      phone: p.phone || "",
      line_id: p.line_id || "",
      report_to: p.report_to || "",
      notes: p.notes || "",
      isNew: false,
    }));
    setRows(peopleRows);

    setReadiness({
      project: !!proj,
      milestones: cMs || 0,
      materials: cMat || 0,
      labor: cLab || 0,
      personnel: peopleRows.length,
      intake_status: ((proj as { intake_status: string } | null)?.intake_status) || "draft",
    });
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { load(); }, [load]);

  function newRow(): PersonnelRow {
    return {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isNew: true,
      full_name: "",
      role_label: "worker",
      phone: "",
      line_id: "",
      start_date: null,
      report_to: "",
      notes: "",
    };
  }

  function addRow() { setRows(rs => [...rs, newRow()]); }

  function update(id: string, patch: Partial<PersonnelRow>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function remove(row: PersonnelRow) {
    if (!row.isNew) {
      if (!confirm(`ลบ "${row.full_name || "(ไม่ระบุ)"}" จาก DB?`)) return;
      const { error } = await supabase.from("skb_site_personnel").delete().eq("id", row.id);
      if (error) { toast.error("ลบไม่ได้: " + error.message); return; }
      toast.success("ลบแล้ว");
    }
    setRows(rs => rs.filter(r => r.id !== row.id));
  }

  function applyPaste(parsed: Record<string, string | number>[]) {
    const newRows: PersonnelRow[] = parsed.map(p => {
      const sd = String(p.start_date || "").trim();
      const roleRaw = String(p.role_label || "").trim();
      const roleCode = mapRoleToCode(roleRaw);
      const specialty = roleRaw && !ROLE_OPTIONS.some(o => o.label === roleRaw || o.value === roleRaw)
        ? roleRaw : "";
      return {
        ...newRow(),
        full_name: String(p.full_name || "").trim(),
        role_label: roleCode,
        phone: String(p.phone || "").trim(),
        line_id: String(p.line_id || "").trim(),
        start_date: /^\d{4}-\d{2}-\d{2}$/.test(sd) ? sd : null,
        notes: specialty ? `[${specialty}]` : "",
      };
    });
    setRows(rs => [...rs, ...newRows]);
  }

  async function saveAll() {
    const valid = rows.filter(r => r.full_name.trim() || r.phone.trim() || r.line_id.trim());
    if (valid.length === 0) { toast.error("ยังไม่มีรายชื่อ"); return; }
    for (const r of valid) {
      if (!r.full_name.trim()) { toast.error("ทุกแถวต้องมีชื่อ-นามสกุล"); return; }
    }
    setSaving(true);
    const inserts: Record<string, unknown>[] = [];
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    for (const r of valid) {
      const code = mapRoleToCode(r.role_label || "");
      const payload = {
        company_id: "SKY001",
        project_id: projectId,
        full_name: r.full_name.trim(),
        role_label: code,
        phone: r.phone?.trim() || null,
        line_id: r.line_id?.trim() || null,
        start_date: r.start_date || null,
        report_to: r.report_to?.trim() || null,
        notes: r.notes?.trim() || null,
      };
      if (r.isNew) inserts.push(payload);
      else updates.push({ id: r.id, patch: payload });
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from("skb_site_personnel").insert(inserts);
      if (error) { setSaving(false); toast.error("Insert: " + error.message); return; }
    }
    for (const u of updates) {
      const { error } = await supabase.from("skb_site_personnel").update(u.patch).eq("id", u.id);
      if (error) { setSaving(false); toast.error("Update: " + error.message); return; }
    }
    setSaving(false);
    toast.success(`บันทึก ${valid.length} คนสำเร็จ`);
    await load();
  }

  async function submitIntake() {
    if (!confirm("ยืนยันส่งฟอร์ม intake?\nหลังส่งแล้ว สถานะจะเปลี่ยนเป็น 'เสร็จสมบูรณ์' และจะถูกส่งให้ทีม cashflow ต่อ")) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("skb_projects")
      .update({
        intake_status: "complete",
        submitted_at: new Date().toISOString(),
        submitted_by: user?.id || null,
      })
      .eq("id", projectId);
    setSubmitting(false);
    if (error) { toast.error("ส่งไม่ได้: " + error.message); return; }
    toast.success("✅ ส่งฟอร์ม intake สำเร็จ!");
    await load();
    setTimeout(() => router.push("/wizard"), 1200);
  }

  const allReady = readiness.project && readiness.milestones >= 1 && readiness.materials >= 1 && readiness.labor >= 1 && readiness.personnel >= 1;
  const isSubmitted = readiness.intake_status === "complete";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">👥 Step 5 · ทีมงานหน้างาน</h2>
            <p className="text-xs text-slate-500">รายชื่อคนที่ทำงานในโครงการนี้ + LINE ID + เบอร์</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPasteOpen(true)} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-200">📋 Paste จาก Excel</button>
            <button onClick={addRow} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200">+ เพิ่มคน</button>
            <button onClick={saveAll} disabled={saving} className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-50">{saving ? "..." : "💾 บันทึกทั้งหมด"}</button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-3xl">👥</p>
            <p className="mt-2 text-sm font-medium text-slate-600">ยังไม่มีรายชื่อทีมงาน</p>
            <p className="text-xs text-slate-500">เริ่มจาก &quot;Paste จาก Excel&quot; หรือ &quot;+ เพิ่มคน&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">ชื่อ-นามสกุล *</th>
                  <th className="px-2 py-2 font-medium">ตำแหน่ง *</th>
                  <th className="px-2 py-2 font-medium">เบอร์</th>
                  <th className="px-2 py-2 font-medium">LINE ID</th>
                  <th className="px-2 py-2 font-medium">วันเริ่ม</th>
                  <th className="px-2 py-2 font-medium">หัวหน้าโดยตรง</th>
                  <th className="px-2 py-2 font-medium">หมายเหตุ</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.id} className={r.isNew ? "bg-amber-50/40" : ""}>
                    <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <input value={r.full_name} onChange={e => update(r.id, { full_name: e.target.value })} className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-1 py-1" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="w-44 rounded border border-slate-300 bg-white px-1 py-1" value={r.role_label} onChange={e => update(r.id, { role_label: e.target.value })}>
                        {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.phone} onChange={e => update(r.id, { phone: e.target.value })} className="w-28 rounded border border-slate-300 bg-white px-1 py-1" placeholder="08x-xxx-xxxx" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.line_id} onChange={e => update(r.id, { line_id: e.target.value })} className="w-28 rounded border border-slate-300 bg-white px-1 py-1" placeholder="line_id" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="date" value={r.start_date || ""} onChange={e => update(r.id, { start_date: e.target.value || null })} className="w-32 rounded border border-slate-300 bg-white px-1 py-1" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.report_to} onChange={e => update(r.id, { report_to: e.target.value })} className="w-28 rounded border border-slate-300 bg-white px-1 py-1" placeholder="—" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.notes} onChange={e => update(r.id, { notes: e.target.value })} className="w-full min-w-[120px] rounded border border-slate-300 bg-white px-1 py-1" placeholder="—" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => remove(r)} className="text-slate-400 hover:text-rose-600">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submission readiness panel */}
      <div className={`rounded-2xl border-2 p-5 shadow-soft ${isSubmitted ? "border-emerald-300 bg-emerald-50" : allReady ? "border-brand-primary/40 bg-brand-primary/5" : "border-amber-300 bg-amber-50"}`}>
        <h3 className="mb-3 text-base font-bold text-slate-800">
          {isSubmitted ? "✅ ส่งฟอร์ม intake แล้ว" : "📤 ส่งฟอร์ม Intake"}
        </h3>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ChecklistCard label="ข้อมูลโครงการ" ok={readiness.project} count={readiness.project ? 1 : 0} />
          <ChecklistCard label="งวดงาน" ok={readiness.milestones >= 1} count={readiness.milestones} />
          <ChecklistCard label="BOQ วัสดุ" ok={readiness.materials >= 1} count={readiness.materials} />
          <ChecklistCard label="BOQ ค่าแรง" ok={readiness.labor >= 1} count={readiness.labor} />
          <ChecklistCard label="ทีมงาน" ok={readiness.personnel >= 1} count={readiness.personnel} />
        </div>

        {isSubmitted ? (
          <p className="text-sm text-emerald-700">โครงการนี้ถูกส่งเรียบร้อย ทีม cashflow / accounting จะดำเนินการต่อ</p>
        ) : (
          <div className="space-y-2">
            {!allReady && (
              <p className="text-xs text-amber-700">⚠️ ต้องมีข้อมูลครบทุกส่วน (อย่างน้อย 1 รายการ) ก่อนส่ง</p>
            )}
            <button
              onClick={submitIntake}
              disabled={!allReady || submitting}
              className="w-full rounded-xl bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "กำลังส่ง..." : "🚀 ส่งฟอร์ม Intake (ปิดงานกรอก)"}
            </button>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft">
        <Link href={`/wizard/${projectId}/boq-labor`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">← BOQ ค่าแรง</Link>
        <Link href="/wizard" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">↩ ฟอร์มหลัก</Link>
      </div>

      <ExcelPasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        columns={PASTE_COLUMNS}
        exampleRow={EXAMPLE}
        onApply={applyPaste}
        title="📋 Paste ทีมงาน"
      />
    </div>
  );
}

function ChecklistCard({ label, ok, count }: { label: string; ok: boolean; count: number }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${ok ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-600">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${ok ? "text-emerald-700" : "text-slate-400"}`}>
        {ok ? "✓" : "—"} {count > 0 ? count : ""}
      </p>
    </div>
  );
}
