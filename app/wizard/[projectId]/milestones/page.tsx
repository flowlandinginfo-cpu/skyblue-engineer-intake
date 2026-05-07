"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fmtTHB } from "@/lib/utils";

interface Milestone {
  id: string;
  milestone_no: number | null;
  milestone_name: string;
  milestone_type: "main" | "sub";
  parent_milestone_id: string | null;
  billing_amount: number;
  billing_percent: number;
  client_approved_amount: number | null;
  plan_start_date: string | null;
  plan_end_date: string | null;
  status: string;
  tasks_summary: string | null;
  acceptance_criteria: string | null;
  responsible_person_id: string | null;
  dependency_milestone_id: string | null;
  notes: string | null;
}

interface Employee { id: string; full_name: string; role_code: string; }

const STATUS_OPTIONS = [
  { v: "pending", l: "🟡 รอเริ่ม" },
  { v: "in_progress", l: "🔵 กำลังทำ" },
  { v: "completed", l: "✅ เสร็จแล้ว" },
  { v: "delayed", l: "🔴 ล่าช้า" },
  { v: "cancelled", l: "⚫ ยกเลิก" },
];

export default function MilestonesStep2() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const supabase = createClient();
  const [contractValue, setContractValue] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddMain, setShowAddMain] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: proj }, { data: ms }, { data: emps }] = await Promise.all([
      supabase.from("skb_projects").select("contract_value").eq("id", projectId).maybeSingle(),
      supabase.from("skb_project_milestones").select("*").eq("project_id", projectId).order("milestone_no", { ascending: true, nullsFirst: false }).order("created_at"),
      supabase.from("employees").select("id, full_name, role_code").eq("company_id", "SKY001").eq("is_approved", true).order("full_name"),
    ]);
    setLoading(false);
    if (proj) setContractValue(Number((proj as { contract_value: number }).contract_value || 0));
    if (ms) setMilestones(ms as Milestone[]);
    if (emps) setEmployees(emps as Employee[]);
  }, [supabase, projectId]);

  useEffect(() => { load(); }, [load]);

  const mains = milestones.filter(m => m.milestone_type === "main");
  const totalBilling = mains.reduce((s, m) => s + Number(m.billing_amount || 0), 0);
  const pctOfContract = contractValue > 0 ? (totalBilling / contractValue) * 100 : 0;
  const isFull = Math.abs(pctOfContract - 100) < 0.01;
  const isOver = pctOfContract > 100.01;

  async function addMilestone(payload: Partial<Milestone>, type: "main" | "sub", parentId?: string) {
    const nextNo = type === "main" ? mains.length + 1 : null;
    setSaving(true);
    const { error } = await supabase.from("skb_project_milestones").insert({
      project_id: projectId,
      company_id: "SKY001",
      milestone_type: type,
      parent_milestone_id: type === "sub" ? parentId : null,
      milestone_no: nextNo,
      milestone_name: payload.milestone_name || "(ยังไม่ตั้งชื่อ)",
      billing_amount: payload.billing_amount ?? 0,
      client_approved_amount: payload.client_approved_amount ?? null,
      plan_start_date: payload.plan_start_date || null,
      plan_end_date: payload.plan_end_date || null,
      status: payload.status || "pending",
      tasks_summary: payload.tasks_summary || null,
      acceptance_criteria: payload.acceptance_criteria || null,
      responsible_person_id: payload.responsible_person_id || null,
      dependency_milestone_id: payload.dependency_milestone_id || null,
      notes: payload.notes || null,
    });
    setSaving(false);
    if (error) { toast.error("เพิ่มไม่สำเร็จ: " + error.message); return; }
    toast.success(type === "main" ? "เพิ่มงวดหลักแล้ว" : "เพิ่มงวดย่อยแล้ว");
    setShowAddMain(false);
    setAddingSubFor(null);
    load();
  }

  async function updateMilestone(id: string, patch: Partial<Milestone>) {
    setSaving(true);
    const { error } = await supabase.from("skb_project_milestones").update(patch).eq("id", id);
    setSaving(false);
    if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
    toast.success("บันทึก");
    load();
  }

  async function removeMilestone(id: string) {
    if (!confirm("ลบงวดนี้? (ลบงวดหลัก = ลบ sub ตามไปด้วย)")) return;
    const { error } = await supabase.from("skb_project_milestones").delete().eq("id", id);
    if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
    toast.success("ลบแล้ว");
    load();
  }

  if (loading) return <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-soft">กำลังโหลด...</p>;

  return (
    <div className="space-y-4">
      {/* Sum bar */}
      <div className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">% ของสัญญาที่กระจาย</span>
          <span className={`font-bold ${isFull ? "text-emerald-600" : isOver ? "text-rose-600" : "text-amber-600"}`}>
            {pctOfContract.toFixed(1)}% ({fmtTHB(totalBilling)} / {fmtTHB(contractValue)} ฿)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full transition-all ${isFull ? "bg-emerald-500" : isOver ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: Math.min(pctOfContract, 100) + "%" }} />
        </div>
        {!isFull && !isOver && <p className="mt-2 text-xs text-amber-700">⚠️ ยังเหลือ {(100 - pctOfContract).toFixed(1)}% ที่ยังไม่ได้กระจาย</p>}
        {isOver && <p className="mt-2 text-xs text-rose-700">⚠️ มูลค่างวดงานเกินสัญญา {(pctOfContract - 100).toFixed(1)}%</p>}
        {isFull && <p className="mt-2 text-xs text-emerald-700">✅ กระจายครบ 100%</p>}
      </div>

      {/* Helpful banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">📝 วิธีกรอกงวดงาน</p>
        <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed">
          <li><b>งวดหลัก (main)</b> = งวดที่เบิกเงินกับลูกค้า — มูลค่ารวมต้องเท่าสัญญา (100%)</li>
          <li><b>งวดย่อย (sub)</b> = แตกย่อยภายในงวดหลัก — ใช้ track ภายใน ไม่เบิกเงิน</li>
          <li>กรอก plan_start_date + plan_end_date เพื่อทำ Gantt chart ภายหลัง</li>
          <li>"Dependency" = งวดนี้ต้องเสร็จหลังงวดอื่น (สำหรับลำดับงาน)</li>
        </ul>
      </div>

      {/* Milestone list */}
      <div className="space-y-3">
        {mains.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            ยังไม่มีงวดงาน — กดปุ่ม "+ เพิ่มงวดหลัก" ด้านล่าง
          </div>
        )}
        {mains.map(main => (
          <MainCard
            key={main.id}
            main={main}
            subs={milestones.filter(m => m.parent_milestone_id === main.id)}
            allMilestones={milestones}
            employees={employees}
            contractValue={contractValue}
            isEditing={editingId === main.id}
            onEdit={() => setEditingId(main.id)}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={(patch) => { updateMilestone(main.id, patch); setEditingId(null); }}
            onDelete={() => removeMilestone(main.id)}
            onAddSubClick={() => setAddingSubFor(main.id)}
            isAddingSub={addingSubFor === main.id}
            onCancelSub={() => setAddingSubFor(null)}
            onAddSub={(payload) => addMilestone(payload, "sub", main.id)}
            onEditSub={(id, patch) => updateMilestone(id, patch)}
            onDeleteSub={(id) => removeMilestone(id)}
            saving={saving}
          />
        ))}
      </div>

      {/* Add main */}
      {!showAddMain ? (
        <button onClick={() => setShowAddMain(true)} className="w-full rounded-xl border-2 border-dashed border-brand-primary/40 py-4 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5">
          + เพิ่มงวดหลัก
        </button>
      ) : (
        <MilestoneForm
          mode="add-main"
          contractValue={contractValue}
          milestones={milestones}
          employees={employees}
          onSubmit={(payload) => addMilestone(payload, "main")}
          onCancel={() => setShowAddMain(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

/* ───────── Main milestone card ───────── */
function MainCard(props: {
  main: Milestone;
  subs: Milestone[];
  allMilestones: Milestone[];
  employees: Employee[];
  contractValue: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: Partial<Milestone>) => void;
  onDelete: () => void;
  onAddSubClick: () => void;
  isAddingSub: boolean;
  onCancelSub: () => void;
  onAddSub: (payload: Partial<Milestone>) => void;
  onEditSub: (id: string, patch: Partial<Milestone>) => void;
  onDeleteSub: (id: string) => void;
  saving: boolean;
}) {
  const { main, subs, allMilestones, employees, contractValue, isEditing, isAddingSub, saving } = props;
  const pct = contractValue > 0 ? (Number(main.billing_amount || 0) / contractValue) * 100 : 0;
  const responsible = employees.find(e => e.id === main.responsible_person_id);
  const dep = allMilestones.find(m => m.id === main.dependency_milestone_id);
  const status = STATUS_OPTIONS.find(s => s.v === main.status);

  if (isEditing) {
    return (
      <MilestoneForm
        mode="edit-main"
        initial={main}
        contractValue={contractValue}
        milestones={allMilestones.filter(m => m.id !== main.id && m.milestone_type === "main")}
        employees={employees}
        onSubmit={props.onUpdate}
        onCancel={props.onCancelEdit}
        saving={saving}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-soft">
      <details open className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
          <div className="flex flex-1 items-center gap-3">
            <span className="rounded-md bg-brand-primary px-2 py-0.5 text-xs font-bold text-white">หลัก #{main.milestone_no || "?"}</span>
            <span className="font-semibold text-slate-800">{main.milestone_name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-slate-500">{subs.length} งวดย่อย</span>
            <span className="font-mono text-brand-primary">{pct.toFixed(1)}%</span>
            <span className="text-xs">{status?.l || main.status}</span>
            <button onClick={(e) => { e.preventDefault(); props.onEdit(); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="แก้ไข">✎</button>
            <button onClick={(e) => { e.preventDefault(); props.onDelete(); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-rose-600" title="ลบ">🗑</button>
          </div>
        </summary>

        <div className="border-t border-slate-100 p-4 text-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div><span className="text-slate-500">มูลค่าเบิก:</span> <b className="text-brand-primary">฿{fmtTHB(main.billing_amount)}</b></div>
            <div><span className="text-slate-500">ลูกค้าอนุมัติเพดาน:</span> {main.client_approved_amount ? <b>฿{fmtTHB(main.client_approved_amount)}</b> : <span className="text-slate-400">—</span>}</div>
            <div><span className="text-slate-500">ผู้รับผิดชอบ:</span> {responsible ? <b>{responsible.full_name}</b> : <span className="text-slate-400">—</span>}</div>
            <div><span className="text-slate-500">เริ่ม:</span> {main.plan_start_date || "—"}</div>
            <div><span className="text-slate-500">สิ้นสุด:</span> {main.plan_end_date || "—"}</div>
            <div><span className="text-slate-500">ขึ้นกับ:</span> {dep ? <b>{dep.milestone_name}</b> : <span className="text-slate-400">—</span>}</div>
            {main.tasks_summary && <div className="md:col-span-3"><span className="text-slate-500">📋 Task หลัก:</span> <span className="whitespace-pre-line">{main.tasks_summary}</span></div>}
            {main.acceptance_criteria && <div className="md:col-span-3"><span className="text-slate-500">✅ หน่วยวัดความสำเร็จ:</span> <span className="whitespace-pre-line">{main.acceptance_criteria}</span></div>}
          </div>

          {/* Sub-milestones */}
          <div className="mt-5 border-t border-dashed border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">งวดย่อย</h4>
              {!isAddingSub && (
                <button onClick={props.onAddSubClick} className="rounded-lg bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary hover:bg-brand-primary hover:text-white">+ เพิ่มงวดย่อย</button>
              )}
            </div>
            <div className="space-y-2">
              {subs.length === 0 && !isAddingSub && <p className="text-xs italic text-slate-400">ยังไม่มีงวดย่อย</p>}
              {subs.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <span className="rounded bg-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700">ย่อย</span>
                  <span className="flex-1 font-medium text-slate-800">{s.milestone_name}</span>
                  <span className="text-xs text-slate-500">{s.plan_start_date || "—"} → {s.plan_end_date || "—"}</span>
                  <button onClick={() => props.onDeleteSub(s.id)} className="rounded p-1 text-slate-400 hover:text-rose-600">🗑</button>
                </div>
              ))}
              {isAddingSub && (
                <MilestoneForm
                  mode="add-sub"
                  contractValue={contractValue}
                  milestones={allMilestones}
                  employees={employees}
                  onSubmit={props.onAddSub}
                  onCancel={props.onCancelSub}
                  saving={saving}
                />
              )}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

/* ───────── Generic milestone form ───────── */
function MilestoneForm(props: {
  mode: "add-main" | "edit-main" | "add-sub";
  initial?: Milestone;
  contractValue: number;
  milestones: Milestone[];
  employees: Employee[];
  onSubmit: (payload: Partial<Milestone>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { mode, initial, contractValue, milestones, employees, saving } = props;
  const isSub = mode === "add-sub";

  const [name, setName] = useState(initial?.milestone_name || "");
  const [billing, setBilling] = useState(initial?.billing_amount?.toString() || "");
  const [clientApproved, setClientApproved] = useState(initial?.client_approved_amount?.toString() || "");
  const [planStart, setPlanStart] = useState(initial?.plan_start_date || "");
  const [planEnd, setPlanEnd] = useState(initial?.plan_end_date || "");
  const [status, setStatus] = useState(initial?.status || "pending");
  const [tasksSummary, setTasksSummary] = useState(initial?.tasks_summary || "");
  const [acceptance, setAcceptance] = useState(initial?.acceptance_criteria || "");
  const [responsibleId, setResponsibleId] = useState(initial?.responsible_person_id || "");
  const [dependencyId, setDependencyId] = useState(initial?.dependency_milestone_id || "");

  const billingNum = Number(billing) || 0;
  const pct = contractValue > 0 ? (billingNum / contractValue) * 100 : 0;

  function submit() {
    if (!name.trim()) { toast.error("กรอกชื่องวด"); return; }
    if (!isSub && billingNum <= 0) { toast.error("กรอกมูลค่าเบิก"); return; }
    props.onSubmit({
      milestone_name: name.trim(),
      billing_amount: billingNum,
      client_approved_amount: clientApproved ? Number(clientApproved) : null,
      plan_start_date: planStart || null,
      plan_end_date: planEnd || null,
      status,
      tasks_summary: tasksSummary || null,
      acceptance_criteria: acceptance || null,
      responsible_person_id: responsibleId || null,
      dependency_milestone_id: dependencyId || null,
    });
  }

  return (
    <div className="rounded-xl border-2 border-brand-primary/30 bg-brand-primary/5 p-4">
      <p className="mb-3 text-sm font-semibold text-brand-primary">
        {mode === "add-main" ? "+ งวดหลักใหม่" : mode === "edit-main" ? "✎ แก้ไขงวด" : "+ งวดย่อยใหม่"}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="ชื่องวด *" className="md:col-span-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น งวดที่ 1: งานเตรียมพื้นที่" className={inputCls} />
        </Field>
        {!isSub && (
          <>
            <Field label="มูลค่าเบิก (วิศวกรประมาณ) *" hint="หลังบันทึก ระบบ auto-sync billing_percent">
              <input type="number" value={billing} onChange={e => setBilling(e.target.value)} placeholder="0" className={inputCls} />
              {billingNum > 0 && <p className="mt-1 text-[11px] text-slate-500">≈ {pct.toFixed(2)}% ของสัญญา</p>}
            </Field>
            <Field label="ลูกค้าอนุมัติเพดาน (บาท)">
              <input type="number" value={clientApproved} onChange={e => setClientApproved(e.target.value)} placeholder="0" className={inputCls} />
            </Field>
          </>
        )}
        <Field label="วันเริ่มแผน">
          <input type="date" value={planStart} onChange={e => setPlanStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="วันสิ้นสุดแผน">
          <input type="date" value={planEnd} onChange={e => setPlanEnd(e.target.value)} className={inputCls} />
        </Field>
        {!isSub && (
          <>
            <Field label="ผู้รับผิดชอบ">
              <select value={responsibleId} onChange={e => setResponsibleId(e.target.value)} className={inputCls}>
                <option value="">— ไม่ระบุ —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.role_code})</option>)}
              </select>
            </Field>
            <Field label="ขึ้นกับงวด (Dependency)">
              <select value={dependencyId} onChange={e => setDependencyId(e.target.value)} className={inputCls}>
                <option value="">— ไม่มี —</option>
                {milestones.filter(m => m.milestone_type === "main").map(m => (
                  <option key={m.id} value={m.id}>งวด {m.milestone_no}: {m.milestone_name}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label="สถานะ">
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
            {STATUS_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Field>
        {!isSub && (
          <>
            <Field label="📋 Task หลัก" className="md:col-span-2">
              <textarea rows={2} value={tasksSummary} onChange={e => setTasksSummary(e.target.value)} placeholder="- งานสำรวจวางผัง&#10;- งานขุดดินฐานราก" className={inputCls} />
            </Field>
            <Field label="✅ หน่วยวัดความสำเร็จ" className="md:col-span-2">
              <textarea rows={2} value={acceptance} onChange={e => setAcceptance(e.target.value)} placeholder="ตรวจรับโครงสร้างจากวิศวกรโครงสร้าง" className={inputCls} />
            </Field>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={props.onCancel} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">ยกเลิก</button>
        <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-60">
          {saving ? "..." : (mode === "edit-main" ? "บันทึก" : "เพิ่ม")}
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">💡 {hint}</p>}
    </div>
  );
}
