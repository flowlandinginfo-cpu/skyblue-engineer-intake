"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Mirror of the public.skb_invite_lookup() jsonb shape.
export interface InviteLookup {
  assignment_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  intake_deadline: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_phone: string | null;
  employee_code: string | null;
  employee_id: string;
  expires_at: string;
  expired: boolean;
  already_clicked: boolean;
  already_registered: boolean;
}

export function InviteForm({
  token,
  info,
}: {
  token: string;
  info: InviteLookup;
}) {
  const supabase = createClient();
  const router = useRouter();

  // Pre-fill from RPC; engineer can correct before submitting.
  const [email, setEmail] = useState(info.assignee_email ?? "");
  const [phone, setPhone] = useState(info.assignee_phone ?? "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("กรอกอีเมลก่อน");
      return;
    }
    if (password.length < 8) {
      toast.error("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== password2) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);

    // 1. Sign up. Supabase signUp returns a session immediately if
    //    auto-confirm is on; otherwise an email is sent.
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: info.assignee_name,
          phone,
          role_label: "engineer",
          invite_token: token, // breadcrumb for /auth/callback
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/wizard?project=${info.project_id}&assignment=${info.assignment_id}`,
        )}`,
      },
    });

    if (signUpErr) {
      // Common case: email already in use → try sign-in instead.
      if (/already registered/i.test(signUpErr.message)) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          toast.error(
            "อีเมลนี้สมัครแล้ว — กรุณาใช้รหัสผ่านเดิม หรือกดลืมรหัสผ่านที่หน้า /sign-in",
          );
          setLoading(false);
          return;
        }
        // Sign-in worked → fall through to the link step.
      } else {
        toast.error("สมัครไม่สำเร็จ: " + signUpErr.message);
        setLoading(false);
        return;
      }
    }

    // Refresh session — handles both signed-up-and-confirmed and signed-in cases.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      // Confirm-email is enabled — engineer must click the email link.
      toast.success("ส่งอีเมลยืนยันแล้ว 🙏", {
        description: `เช็คอีเมล ${email} — ลิงก์จะพากลับมาที่ wizard เอง`,
        duration: 12000,
      });
      setLoading(false);
      return;
    }

    // 2. Link auth_user_id ↔ assignment.assignee_employee_id via SECURITY DEFINER wrapper.
    const { data: completeData, error: completeErr } = await supabase.rpc(
      "skb_invite_complete",
      {
        p_token: token,
        p_auth_user_id: user.id,
        p_phone: phone || null,
      },
    );

    if (completeErr) {
      toast.error("ผูกบัญชีไม่สำเร็จ: " + completeErr.message);
      setLoading(false);
      return;
    }
    const res = completeData as { ok: boolean; error?: string } | null;
    if (!res?.ok) {
      toast.error("ผูกบัญชีไม่สำเร็จ: " + (res?.error ?? "unknown"));
      setLoading(false);
      return;
    }

    toast.success("✅ ผูกบัญชีสำเร็จ — เริ่มกรอกโครงการกันเลย");

    // 3. Send them straight into the wizard, scoped to this assignment.
    router.push(
      `/wizard?project=${info.project_id}&assignment=${info.assignment_id}`,
    );
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-700 via-cyan-600 to-cyan-500 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-cyan-700 to-cyan-600 px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-wider opacity-90">
            Sky Blue Construction · Engineer Invite
          </div>
          <h1 className="mt-1 text-lg font-bold">👋 บอทรู้ว่าคุณคือ</h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-lg bg-white/15 px-3 py-2">
              <div className="text-base font-semibold leading-tight">
                {info.assignee_name ?? "ไม่ทราบชื่อ"}
              </div>
              {info.employee_code && (
                <div className="text-xs opacity-90">{info.employee_code}</div>
              )}
            </div>
          </div>
        </div>

        {/* Project card */}
        <div className="border-b border-slate-100 bg-amber-50 px-6 py-4">
          <div className="text-xs font-medium uppercase tracking-wider text-amber-700">
            📋 โครงการที่ได้รับมอบหมาย
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-amber-900">
            {info.project_code}
          </div>
          <div className="text-sm text-slate-700">{info.project_name}</div>
          {info.intake_deadline && (
            <div className="mt-2 text-xs text-slate-500">
              📅 deadline: {new Date(info.intake_deadline).toLocaleDateString("th-TH")}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              📞 เบอร์โทรศัพท์ {info.assignee_phone ? "(แก้ไขได้)" : "*"}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08X-XXX-XXXX"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              📧 อีเมล *
              {info.assignee_email ? (
                <span className="ml-1 text-emerald-600">(จากระบบ)</span>
              ) : (
                <span className="ml-1 text-amber-600">(ยังไม่มีในระบบ — กรอกใหม่)</span>
              )}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@skyblue.example"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              🔒 ตั้งรหัสผ่าน *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="≥ 8 ตัวอักษร"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              ยืนยันรหัสผ่าน *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-700 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-800 disabled:opacity-60"
          >
            {loading
              ? "กำลังสมัคร..."
              : "✓ ยืนยันใช่ฉัน → สมัคร + เริ่มกรอกโครงการ"}
          </button>

          <Link
            href="/sign-in"
            className="block w-full rounded-xl border border-slate-300 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ไม่ใช่ฉัน — ไปหน้าเข้าสู่ระบบปกติ
          </Link>

          <p className="pt-2 text-center text-xs text-slate-400">
            ลิงก์นี้ใช้ครั้งเดียว · หมดอายุ{" "}
            {new Date(info.expires_at).toLocaleDateString("th-TH")}
          </p>
        </form>
      </div>
    </main>
  );
}
