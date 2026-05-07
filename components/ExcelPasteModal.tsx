"use client";

import { useState } from "react";
import { toast } from "sonner";

export interface ExcelColumn {
  key: string;
  label: string;
  type?: "text" | "number";
}

interface Props {
  open: boolean;
  onClose: () => void;
  columns: ExcelColumn[];        // expected order in pasted text
  exampleRow: string;            // single example line (tab-separated)
  onApply: (rows: Record<string, string | number>[]) => void;
  title?: string;
}

export default function ExcelPasteModal({ open, onClose, columns, exampleRow, onApply, title = "📋 Paste จาก Excel" }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Record<string, string | number>[] | null>(null);

  if (!open) return null;

  function parse() {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error("paste อะไรก่อน"); return; }
    const rows: Record<string, string | number>[] = [];
    for (const line of lines) {
      const cells = line.split("\t");
      const row: Record<string, string | number> = {};
      columns.forEach((col, i) => {
        const raw = (cells[i] || "").trim();
        row[col.key] = col.type === "number" ? (Number(raw) || 0) : raw;
      });
      rows.push(row);
    }
    setPreview(rows);
  }

  function apply() {
    if (!preview) { parse(); return; }
    onApply(preview);
    setText(""); setPreview(null);
    toast.success(`เพิ่ม ${preview.length} แถวสำเร็จ`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-10" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">×</button>
        </div>

        <p className="mb-2 text-sm text-slate-600">copy หลายแถวจาก Excel แล้ว paste ลงด้านล่าง</p>
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <p className="font-medium text-slate-700">รูปแบบ (คอลัมน์ตามลำดับ):</p>
          <p className="mt-1 text-slate-600">{columns.map(c => c.label).join(" → ")}</p>
        </div>

        {!preview ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            placeholder={exampleRow}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {columns.map(c => <th key={c.key} className="px-2 py-2 text-left font-medium text-slate-600">{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, i) => (
                  <tr key={i}>
                    {columns.map(c => <td key={c.key} className="px-2 py-1.5 text-slate-700">{String(row[c.key] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">{preview.length} แถวพร้อมเพิ่ม</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={() => setText(exampleRow)} className="text-xs text-brand-primary hover:underline">ใส่ตัวอย่าง</button>
          <div className="flex gap-2">
            {preview && <button onClick={() => setPreview(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">← Edit</button>}
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">ยกเลิก</button>
            <button onClick={apply} className="rounded-lg bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark">
              {preview ? `เพิ่ม ${preview.length} แถว` : "Parse →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
