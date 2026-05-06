"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function SignInForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/wizard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("เข้าสู่ระบบล้มเหลว: " + error.message);
      return;
    }
    toast.success("ยินดีต้อนรับ!");
    router.push(next);
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) { toast.error("กรอกอีเมลก่อน"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) {
      toast.error("ส่ง magic link ไม่สำเร็จ: " + error.message);
      return;
    }
    toast.success("ส่ง magic link ไปที่ " + email + " แล้ว เช็คอีเมล");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-primary via-brand-primary-light to-cyan-700 px-4 py-10">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-2">
        {/* Left brand panel */}
        <div className="relative hidden flex-col justify-between bg-brand-primary p-10 text-white md:flex">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl">🏗️</div>
              <div>
                <h2 className="text-xl font-bold">Sky Blue Construction</h2>
                <p className="text-xs opacity-80">Engineer Intake System</p>
              </div>
            </div>
            <h3 className="mt-10 text-2xl font-semibold leading-snug">บันทึกโครงการเสร็จใน 5 ขั้น<br/>ก่อนเริ่มหน้างานจริง</h3>
            <p className="mt-3 text-sm opacity-90">ฟอร์มสำหรับวิศวกร — paste จาก Excel ได้, ไม่ต้องพิมพ์เยอะ, มี AI ช่วย</p>
          </div>
          <div className="space-y-2 text-xs opacity-80">
            <div>✓ Sync ไป Supabase ทันที</div>
            <div>✓ Mobile-first สำหรับหน้างาน</div>
            <div>✓ ระบบทวงถามอัตโนมัติ</div>
          </div>
        </div>

        {/* Right form */}
        <div className="p-8 sm:p-10">
          <h1 className="mb-1 text-2xl font-bold text-slate-800">เข้าสู่ระบบ</h1>
          <p className="mb-6 text-sm text-slate-500">สำหรับวิศวกรและทีมที่ได้รับอนุมัติ</p>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">อีเมล</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@skyblue.co.th"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">รหัสผ่าน</label>
              <input
                type="password" required minLength={6}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-dark disabled:opacity-60">
              {loading ? "กำลังเข้า..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400">หรือ</span></div>
          </div>

          <button onClick={handleMagicLink} disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            ✉ ส่ง Magic Link ไปอีเมล
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            ยังไม่มีบัญชี? <Link href="/sign-up" className="font-semibold text-brand-primary hover:underline">สมัครเป็นวิศวกร</Link>
          </p>

          <div className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            💡 รอบแรก: Boss ต้อง enable Email auth + (optional) "Auto-confirm" ใน Supabase Dashboard → Authentication → Providers → Email
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">กำลังโหลด...</div>}>
      <SignInForm />
    </Suspense>
  );
}
