"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const ROLE_OPTIONS = [
  { value: "engineer", label: "วิศวกร" },
  { value: "foreman", label: "โฟร์แมน" },
  { value: "site_manager", label: "Site Manager" },
];

export default function SignUpPage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [role, setRole] = useState("engineer");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) { toast.error("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 8) { toast.error("รหัสผ่านอย่างน้อย 8 ตัวอักษร"); return; }
    setLoading(true);

    // Sign up — Supabase will email confirm link.
    // Employees row is created in /auth/callback after email confirmation
    // (handles both auto-confirm and confirm-required modes).
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: name, phone, line_id: lineId, role_label: role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      toast.error("สมัครไม่สำเร็จ: " + error.message);
      return;
    }

    // If session is already active (Auto-confirm enabled in Supabase):
    if (data.session) {
      toast.success("สมัครสำเร็จ — กำลังพาไปกรอกข้อมูล");
      // Trigger callback flow which will create the employees row
      window.location.href = "/auth/callback?code=skip&next=/wizard";
      return;
    }

    // Confirm-email mode — user must check inbox
    toast.success("สมัครสำเร็จ", {
      description: `เช็คอีเมล ${email} เพื่อยืนยันบัญชี — ลิงก์จะพากลับมาที่นี่`,
      duration: 10000,
    });
    router.push("/sign-in");
  }

  const roleOpts = ROLE_OPTIONS.map(r => `<option value="${r.value}">${r.label}</option>`).join("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-primary via-brand-primary-light to-cyan-700 px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white text-2xl">👷</div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">สมัครเป็นวิศวกร</h1>
            <p className="text-sm text-slate-500">บัญชีจะรอ admin อนุมัติก่อนใช้งานได้</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">ชื่อ-นามสกุล (ภาษาไทย) *</label>
            <input required value={name} onChange={e => setName(e.target.value)}
              placeholder="นายวิศวกร ใจดี"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">อีเมล *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@skyblue.co.th"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ตำแหน่ง *</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none">
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">เบอร์โทรศัพท์ *</label>
            <input required value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="08X-XXX-XXXX"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">LINE ID *</label>
            <input required value={lineId} onChange={e => setLineId(e.target.value)}
              placeholder="line_id"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">รหัสผ่าน *</label>
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="≥ 8 ตัวอักษร"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ยืนยันรหัสผ่าน *</label>
            <input type="password" required minLength={8} value={password2} onChange={e => setPassword2(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
            <Link href="/sign-in" className="text-sm text-slate-500 hover:text-slate-700">← กลับไปเข้าสู่ระบบ</Link>
            <button type="submit" disabled={loading}
              className="rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-60">
              {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠️ หลังสมัคร — บัญชีจะมีสถานะ <b>"รอ admin อนุมัติ"</b> ใช้งานยังไม่ได้จนกว่า manager หรือ admin จะกด approve
        </div>
      </div>
    </main>
  );
}
