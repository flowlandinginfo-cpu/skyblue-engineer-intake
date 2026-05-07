"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export interface Milestone {
  id: string;
  milestone_name: string;
  milestone_no: number | null;
  milestone_type: "main" | "sub";
  parent_milestone_id: string | null;
  billing_amount: number;
}

interface AllocationRow {
  id: string;            // local key
  phase_id: string;
  subphase_id: string;
  percent: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  type: "material" | "labor";    // selects table to write
  boqRowId: string;              // skb_boq_materials.id or skb_boq_labor.id
  boqRowLabel: string;           // human label (item name)
  milestones: Milestone[];
  onSaved: () => void;           // re-fetch after save
}

export default function AllocationModal({ open, onClose, type, boqRowId, boqRowLabel, milestones, onSaved }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tableName = type === "material" ? "skb_boq_material_allocations" : "skb_boq_labor_allocations";
  const fkCol = type === "material" ? "boq_material_id" : "boq_labor_id";
  const phases = milestones.filter(m => m.milestone_type === "main");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from(tableName)
        .select("id, phase_id, subphase_id, percent")
        .eq(fkCol, boqRowId);
      setLoading(false);
      const seed: AllocationRow[] = (data || []).map((r, i) => ({
        id: `db-${i}-${(r as { id: string }).id}`,
        phase_id: (r as { phase_id: string }).phase_id,
        subphase_id: ((r as { subphase_id: string | null }).subphase_id) || "",
        percent: Number((r as { percent: number }).percent) || 0,
      }));
      if (seed.length === 0) seed.push({ id: "new-1", phase_id: "", subphase_id: "", percent: 0 });
      setRows(seed);
    })();
  }, [open, boqRowId, tableName, fkCol, supabase]);

  if (!open) return null;

  const total = rows.reduce((s, r) => s + Number(r.percent || 0), 0);
  const isFull = Math.abs(total - 100) < 0.01;

  function update(i: number, patch: Partial<AllocationRow>) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function remove(i: number) {
    setRows(rs => rs.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setRows(rs => [...rs, { id: `new-${Date.now()}`, phase_id: "", subphase_id: "", percent: 0 }]);
  }
  function autoAllocate() {
    if (phases.length === 0) { toast.error("ยังไม่มีงวดหลัก"); return; }
    const each = Math.floor(10000 / phases.length) / 100;
    const newRows = phases.map((p, i) => ({
      id: `auto-${i}`,
      phase_id: p.id,
      subphase_id: "",
      percent: i === phases.length - 1 ? Number((100 - each * (phases.length - 1)).toFixed(2)) : each,
    }));
    setRows(newRows);
    toast.success(`Auto allocate ${phases.length} งวด`);
  }
  function clearAll() {
    setRows([{ id: "new-1", phase_id: "", subphase_id: "", percent: 0 }]);
  }

  async function save() {
    const filtered = rows.filter(r => r.phase_id);
    if (filtered.length === 0) { toast.error("ต้องมีอย่างน้อย 1 งวด"); return; }
    if (Math.abs(filtered.reduce((s, r) => s + r.percent, 0) - 100) > 0.01) {
      toast.error("รวมต้องได้ 100% พอดี"); return;
    }
    const seen = new Set<string>();
    for (const r of filtered) {
      const k = `${r.phase_id}|${r.subphase_id || ""}`;
      if (seen.has(k)) { toast.error("มีงวด+งวดย่อยซ้ำ"); return; }
      seen.add(k);
    }

    setSaving(true);
    // Wipe + re-insert (simpler than diff). DEFERRED constraint trigger
    // checks sum=100 only at commit, so this delete+insert works inside one txn.
    await supabase.from(tableName).delete().eq(fkCol, boqRowId);
    const inserts = filtered.map(r => ({
      company_id: "SKY001",
      [fkCol]: boqRowId,
      phase_id: r.phase_id,
      subphase_id: r.subphase_id || null,
      percent: r.percent,
    }));
    const { error } = await supabase.from(tableName).insert(inserts);
    setSaving(false);
    if (error) { toast.error("บันทึกไม่ได้: " + error.message); return; }
    toast.success("บันทึก allocation สำเร็จ");
    onSaved();
    onClose();
  }

  function copyFromPrevious() {
    toast("ฟีเจอร์ copy จะมาในรอบหน้า");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-10" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">🧩 กำหนด Allocation</h3>
            <p className="text-xs text-slate-500">{boqRowLabel}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">×</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={autoAllocate} className="flex items-center gap-1 rounded-lg bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary hover:text-white">🪄 Auto Allocate</button>
          <button onClick={copyFromPrevious} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">📋 Copy</button>
          <button onClick={addRow} className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200">+ เพิ่มแถว</button>
          <button onClick={clearAll} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">ล้าง</button>
        </div>

        {loading ? <p className="py-6 text-center text-sm text-slate-400">โหลด...</p> : (
          <div className="max-h-72 overflow-y-auto space-y-2">
            {rows.map((r, i) => {
              const phase = phases.find(p => p.id === r.phase_id);
              const subs = phase ? milestones.filter(m => m.parent_milestone_id === phase.id) : [];
              return (
                <div key={r.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                  <span className="col-span-1 text-center text-xs font-mono text-slate-400">#{i + 1}</span>
                  <select className="col-span-5 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" value={r.phase_id} onChange={e => update(i, { phase_id: e.target.value, subphase_id: "" })}>
                    <option value="">— เลือกงวดหลัก —</option>
                    {phases.map(p => <option key={p.id} value={p.id}>งวด {p.milestone_no}: {p.milestone_name}</option>)}
                  </select>
                  <select className="col-span-3 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" disabled={subs.length === 0} value={r.subphase_id} onChange={e => update(i, { subphase_id: e.target.value })}>
                    <option value="">{subs.length === 0 ? "(ไม่มีงวดย่อย)" : "— ทั้งงวดหลัก —"}</option>
                    {subs.map(s => <option key={s.id} value={s.id}>{s.milestone_name}</option>)}
                  </select>
                  <div className="col-span-2 flex items-center gap-1">
                    <input type="number" min={0} max={100} step={0.1} value={r.percent} onChange={e => update(i, { percent: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-xs" />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <button onClick={() => remove(i)} className="col-span-1 rounded p-1 text-slate-400 hover:text-rose-600">🗑</button>
                </div>
              );
            })}
          </div>
        )}

        <div className={`mt-4 rounded-xl border-2 p-3 text-center font-semibold ${isFull ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
          {isFull ? "✅ รวมครบ 100%" : `⏳ ${total.toFixed(1)}% / 100%`}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">ยกเลิก</button>
          <button onClick={save} disabled={saving || !isFull} className="rounded-lg bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-50">
            {saving ? "..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
