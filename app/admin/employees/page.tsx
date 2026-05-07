"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Emp {
  id: string;
  employee_code: string | null;
  full_name: string;
  role_code: string;
  is_approved: boolean;
  hr_verified: boolean;
  auth_user_id: string | null;
  approved_at: string | null;
  created_at: string;
}

const ROLE_OPTIONS = [
  "engineer", "foreman", "site_manager", "skilled_worker",
  "field_worker", "manager", "owner", "admin", "finance",
  "procurement", "logistics", "employee",
];

export default function AdminEmployeesPage() {
  const supabase = createClient();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_code, full_name, role_code, is_approved, hr_verified, auth_user_id, approved_at, created_at")
      .eq("company_id", "SKY001")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("โหลดไม่ได้: " + error.message); return; }
    if (data) setEmps(data as Emp[]);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function approveEmp(id: string) {
    const { error } = await supabase
      .from("employees")
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Approve fail: " + error.message); return; }
    toast.success("อนุมัติแล้ว");
    load();
  }
  async function revokeEmp(id: string) {
    const { error } = await supabase
      .from("employees")
      .update({ is_approved: false })
      .eq("id", id);
    if (error) { toast.error("Revoke fail: " + error.message); return; }
    toast.success("ระงับแล้ว", { description: "ผู้ใช้จะใช้งานไม่ได้จนกว่าจะ approve อีกครั้ง" });
    load();
  }
  async function changeRole(id: string, role: string) {
    const { error } = await supabase
      .from("employees")
      .update({ role_code: role })
      .eq("id", id);
    if (error) { toast.error("Change role fail: " + error.message); return; }
    toast.success("เปลี่ยน role แล้ว");
    load();
  }

  const pending = emps.filter(e => !e.is_approved);
  const approved = emps.filter(e => e.is_approved);
  const list = tab === "pending" ? pending : approved;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">👥 จัดการพนักงาน</h1>
            <p className="text-sm text-slate-500">อนุมัติ + เปลี่ยน role · บริษัท SKY001</p>
          </div>
          <button onClick={load} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">↻ Refresh</button>
        </div>

        <div className="mb-5 flex gap-2 border-b border-slate-200">
          <button onClick={() => setTab("pending")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === "pending" ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            ⚠️ รออนุมัติ <span className="ml-1 rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
          </button>
          <button onClick={() => setTab("approved")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === "approved" ? "border-brand-success text-brand-success" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            ✅ พนักงานทั้งหมด ({approved.length})
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : list.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {tab === "pending" ? "ไม่มีพนักงานรออนุมัติ" : "ยังไม่มีพนักงาน"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">พนักงาน</th>
                  <th className="px-4 py-3">รหัส</th>
                  <th className="px-4 py-3">ตำแหน่ง</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(e => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">{e.full_name?.slice(0, 1) || "?"}</div>
                        <div>
                          <p className="font-medium text-slate-800">{e.full_name}</p>
                          <p className="text-[11px] text-slate-500">{e.auth_user_id ? "🔐 มี auth" : "📋 ยังไม่ link auth"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{e.employee_code || "—"}</td>
                    <td className="px-4 py-3">
                      <select value={e.role_code} onChange={ev => changeRole(e.id, ev.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {e.is_approved
                        ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">✓ อนุมัติแล้ว</span>
                        : <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">⏳ รออนุมัติ</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.is_approved
                        ? <button onClick={() => revokeEmp(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-brand-danger" title="ระงับ">⊘</button>
                        : <button onClick={() => approveEmp(e.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">✓ อนุมัติ</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
