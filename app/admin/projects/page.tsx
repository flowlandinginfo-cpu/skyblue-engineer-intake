"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fmtTHB } from "@/lib/utils";

interface Proj {
  id: string;
  project_code: string;
  project_name: string;
  client_name: string | null;
  contract_value: number;
  start_date: string | null;
  end_date: string | null;
  intake_status: string;
  intake_deadline: string | null;
  status: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  phase_done: "bg-blue-100 text-blue-700",
  boq_done: "bg-indigo-100 text-indigo-700",
  team_done: "bg-amber-100 text-amber-700",
  complete: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  phase_done: "เสร็จงวดงาน",
  boq_done: "เสร็จ BOQ",
  team_done: "เสร็จทีม",
  complete: "ครบ ส่งแล้ว",
};

export default function AdminProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<Proj[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("skb_projects")
      .select("id, project_code, project_name, client_name, contract_value, start_date, end_date, intake_status, intake_deadline, status, created_at")
      .eq("company_id", "SKY001")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("โหลดไม่ได้: " + error.message); return; }
    if (data) setProjects(data as Proj[]);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🏗️ จัดการโครงการ</h1>
            <p className="text-sm text-slate-500">รายการโครงการทั้งหมดของ SKY001</p>
          </div>
          <button onClick={load} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">↻ Refresh</button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            ยังไม่มีโครงการ — <Link href="/wizard" className="text-brand-primary hover:underline">สร้างโครงการแรก</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">รหัส</th>
                  <th className="px-4 py-3">ชื่อโครงการ</th>
                  <th className="px-4 py-3">เจ้าของงาน</th>
                  <th className="px-4 py-3 text-right">มูลค่า</th>
                  <th className="px-4 py-3">ระยะเวลา</th>
                  <th className="px-4 py-3">สถานะ Intake</th>
                  <th className="px-4 py-3">สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-primary">{p.project_code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.project_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.client_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-800">฿{fmtTHB(p.contract_value)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.start_date} → {p.end_date}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[p.intake_status] || "bg-slate-100 text-slate-700"}`}>
                        {STATUS_LABEL[p.intake_status] || p.intake_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{new Date(p.created_at).toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right text-slate-600">รวมมูลค่า:</td>
                  <td className="px-4 py-3 text-right font-mono text-base text-brand-primary">
                    ฿{fmtTHB(projects.reduce((s, p) => s + Number(p.contract_value || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs text-slate-500">{projects.length} โครงการ</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
