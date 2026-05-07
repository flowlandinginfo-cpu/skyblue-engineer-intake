"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import ExcelPasteModal from "@/components/ExcelPasteModal";
import AllocationModal, { Milestone } from "@/components/AllocationModal";
import { fmtTHB } from "@/lib/utils";

interface MaterialRow {
  id: string;                  // db id OR local "new-..."
  isNew?: boolean;
  category: string;
  material_code: string;
  item_name: string;
  unit: string;
  quantity: number;
  buffer_percent: number;
  unit_price: number;
  supplier_name: string;
  notes: string;
  // local-only:
  alloc_count?: number;
  alloc_complete?: boolean;
}

const CATEGORIES = ["โครงสร้าง", "สถาปัตย์", "ไฟฟ้า", "ประปา/สุขาภิบาล", "ตกแต่ง", "อื่นๆ"];

const PASTE_COLUMNS = [
  { key: "category", label: "หมวดหมู่", type: "text" as const },
  { key: "item_name", label: "ชื่อวัสดุ", type: "text" as const },
  { key: "unit", label: "หน่วย", type: "text" as const },
  { key: "quantity", label: "ปริมาณ", type: "number" as const },
  { key: "unit_price", label: "ราคา/หน่วย", type: "number" as const },
];

const EXAMPLE = "โครงสร้าง\tปูนซีเมนต์\tถุง\t100\t180\nโครงสร้าง\tเหล็กเส้น DB12\tเส้น\t250\t420";

export default function BoqMaterialsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const supabase = createClient();

  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [allocFor, setAllocFor] = useState<{ id: string; label: string } | null>(null);

  async function loadAll() {
    setLoading(true);
    // 1. milestones
    const { data: ms } = await supabase
      .from("skb_project_milestones")
      .select("id, milestone_name, milestone_no, milestone_type, parent_milestone_id, billing_amount")
      .eq("project_id", projectId)
      .order("milestone_no", { ascending: true });
    setMilestones((ms as Milestone[]) || []);

    // 2. materials
    const { data: mats } = await supabase
      .from("skb_boq_materials")
      .select("id, category, material_code, item_name, unit, quantity, buffer_percent, unit_price, supplier_name, notes")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const matRows: MaterialRow[] = ((mats as MaterialRow[]) || []).map(m => ({ ...m, isNew: false }));

    // 3. allocations counts per material
    if (matRows.length > 0) {
      const { data: allocs } = await supabase
        .from("skb_boq_material_allocations")
        .select("boq_material_id, percent")
        .in("boq_material_id", matRows.map(r => r.id));
      const sums: Record<string, { count: number; total: number }> = {};
      ((allocs as { boq_material_id: string; percent: number }[]) || []).forEach(a => {
        const s = sums[a.boq_material_id] || { count: 0, total: 0 };
        s.count += 1;
        s.total += Number(a.percent || 0);
        sums[a.boq_material_id] = s;
      });
      matRows.forEach(r => {
        const s = sums[r.id];
        r.alloc_count = s ? s.count : 0;
        r.alloc_complete = s ? Math.abs(s.total - 100) < 0.01 : false;
      });
    }

    setRows(matRows);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function newRow(): MaterialRow {
    return {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isNew: true,
      category: "",
      material_code: "",
      item_name: "",
      unit: "",
      quantity: 0,
      buffer_percent: 0,
      unit_price: 0,
      supplier_name: "",
      notes: "",
      alloc_count: 0,
      alloc_complete: false,
    };
  }

  function addRow() {
    setRows(rs => [...rs, newRow()]);
  }

  function update(id: string, patch: Partial<MaterialRow>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function remove(row: MaterialRow) {
    if (!row.isNew) {
      if (!confirm(`ลบ "${row.item_name || "(ไม่ระบุ)"}" จาก DB?`)) return;
      const { error } = await supabase.from("skb_boq_materials").delete().eq("id", row.id);
      if (error) {
        toast.error("ลบไม่ได้: " + error.message);
        return;
      }
      toast.success("ลบแล้ว");
    }
    setRows(rs => rs.filter(r => r.id !== row.id));
  }

  function applyPaste(parsed: Record<string, string | number>[]) {
    const newRows: MaterialRow[] = parsed.map(p => ({
      ...newRow(),
      category: String(p.category || ""),
      item_name: String(p.item_name || ""),
      unit: String(p.unit || ""),
      quantity: Number(p.quantity || 0),
      unit_price: Number(p.unit_price || 0),
    }));
    setRows(rs => [...rs, ...newRows]);
  }

  async function saveAll() {
    // Validate non-empty rows
    const valid = rows.filter(r => r.item_name.trim() || r.category.trim() || r.quantity > 0);
    if (valid.length === 0) { toast.error("ยังไม่มีรายการ"); return; }
    for (const r of valid) {
      if (!r.item_name.trim()) { toast.error("ทุกแถวต้องมีชื่อวัสดุ"); return; }
      if (!r.unit.trim()) { toast.error(`"${r.item_name}" ยังไม่ระบุหน่วย`); return; }
    }

    setSaving(true);
    const inserts: Record<string, unknown>[] = [];
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    for (const r of valid) {
      const payload = {
        company_id: "SKY001",
        project_id: projectId,
        category: r.category || null,
        material_code: r.material_code || null,
        item_name: r.item_name,
        unit: r.unit,
        quantity: r.quantity,
        buffer_percent: r.buffer_percent,
        unit_price: r.unit_price,
        supplier_name: r.supplier_name || null,
        notes: r.notes || null,
      };
      if (r.isNew) inserts.push(payload);
      else updates.push({ id: r.id, patch: payload });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("skb_boq_materials").insert(inserts);
      if (error) { setSaving(false); toast.error("Insert: " + error.message); return; }
    }
    for (const u of updates) {
      const { error } = await supabase.from("skb_boq_materials").update(u.patch).eq("id", u.id);
      if (error) { setSaving(false); toast.error("Update: " + error.message); return; }
    }
    setSaving(false);
    toast.success(`บันทึก ${valid.length} รายการสำเร็จ`);
    await loadAll();
  }

  const totalCost = rows.reduce((s, r) => s + r.quantity * (1 + r.buffer_percent / 100) * r.unit_price, 0);
  const allocComplete = rows.filter(r => !r.isNew && r.alloc_complete).length;
  const allocPending = rows.filter(r => !r.isNew && !r.alloc_complete).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">📦 Step 3 · BOQ วัสดุ</h2>
            <p className="text-xs text-slate-500">รายการวัสดุ + ราคา + กระจายเข้างวดงาน (allocation)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPasteOpen(true)} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-200">
              📋 Paste จาก Excel
            </button>
            <button onClick={addRow} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200">
              + เพิ่มแถว
            </button>
            <button onClick={saveAll} disabled={saving} className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-50">
              {saving ? "..." : "💾 บันทึกทั้งหมด"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-3xl">📦</p>
            <p className="mt-2 text-sm font-medium text-slate-600">ยังไม่มีรายการวัสดุ</p>
            <p className="text-xs text-slate-500">เริ่มจาก &quot;Paste จาก Excel&quot; หรือ &quot;+ เพิ่มแถว&quot; ด้านบน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">หมวด</th>
                  <th className="px-2 py-2 font-medium">รหัส</th>
                  <th className="px-2 py-2 font-medium">ชื่อวัสดุ *</th>
                  <th className="px-2 py-2 font-medium">หน่วย *</th>
                  <th className="px-2 py-2 text-right font-medium">ปริมาณ</th>
                  <th className="px-2 py-2 text-right font-medium">Buffer %</th>
                  <th className="px-2 py-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="px-2 py-2 text-right font-medium">รวม</th>
                  <th className="px-2 py-2 font-medium">ผู้ขาย</th>
                  <th className="px-2 py-2 text-center font-medium">Allocation</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => {
                  const total = r.quantity * (1 + r.buffer_percent / 100) * r.unit_price;
                  return (
                    <tr key={r.id} className={r.isNew ? "bg-amber-50/40" : ""}>
                      <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <select className="w-full rounded border border-slate-300 bg-white px-1 py-1" value={r.category} onChange={e => update(r.id, { category: e.target.value })}>
                          <option value="">—</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={r.material_code} onChange={e => update(r.id, { material_code: e.target.value })} className="w-20 rounded border border-slate-300 bg-white px-1 py-1" placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={r.item_name} onChange={e => update(r.id, { item_name: e.target.value })} className="w-full min-w-[160px] rounded border border-slate-300 bg-white px-1 py-1" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={r.unit} onChange={e => update(r.id, { unit: e.target.value })} className="w-16 rounded border border-slate-300 bg-white px-1 py-1" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} step={0.01} value={r.quantity} onChange={e => update(r.id, { quantity: Number(e.target.value) || 0 })} className="w-20 rounded border border-slate-300 bg-white px-1 py-1 text-right" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} max={100} step={0.5} value={r.buffer_percent} onChange={e => update(r.id, { buffer_percent: Number(e.target.value) || 0 })} className="w-16 rounded border border-slate-300 bg-white px-1 py-1 text-right" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} step={0.01} value={r.unit_price} onChange={e => update(r.id, { unit_price: Number(e.target.value) || 0 })} className="w-24 rounded border border-slate-300 bg-white px-1 py-1 text-right" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-700">฿{fmtTHB(total)}</td>
                      <td className="px-2 py-1.5">
                        <input value={r.supplier_name} onChange={e => update(r.id, { supplier_name: e.target.value })} className="w-28 rounded border border-slate-300 bg-white px-1 py-1" placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.isNew ? (
                          <span className="text-xs text-slate-400">บันทึกก่อน</span>
                        ) : (
                          <button
                            onClick={() => setAllocFor({ id: r.id, label: r.item_name })}
                            className={`rounded px-2 py-1 text-xs font-medium ${r.alloc_complete ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : r.alloc_count ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            {r.alloc_complete ? "✅ 100%" : r.alloc_count ? `⏳ ${r.alloc_count} งวด` : "🧩 กำหนด"}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => remove(r)} className="text-slate-400 hover:text-rose-600">🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={8} className="px-2 py-2 text-right text-slate-700">รวมทั้งสิ้น (รวม buffer):</td>
                  <td className="px-2 py-2 text-right font-mono text-brand-primary">฿{fmtTHB(totalCost)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary */}
        {!loading && rows.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">จำนวนรายการ</p>
              <p className="text-lg font-bold text-slate-800">{rows.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-xs text-emerald-700">Allocation ครบ 100%</p>
              <p className="text-lg font-bold text-emerald-700">{allocComplete}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-700">ยังไม่ครบ / ยังไม่กำหนด</p>
              <p className="text-lg font-bold text-amber-700">{allocPending}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <Link href={`/wizard/${projectId}/milestones`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">← งวดงาน</Link>
          <Link href={`/wizard/${projectId}/boq-labor`} className="rounded-lg bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark">ค่าแรง →</Link>
        </div>
      </div>

      <ExcelPasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        columns={PASTE_COLUMNS}
        exampleRow={EXAMPLE}
        onApply={applyPaste}
        title="📋 Paste BOQ วัสดุ"
      />

      {allocFor && (
        <AllocationModal
          open={!!allocFor}
          onClose={() => setAllocFor(null)}
          type="material"
          boqRowId={allocFor.id}
          boqRowLabel={allocFor.label}
          milestones={milestones}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
