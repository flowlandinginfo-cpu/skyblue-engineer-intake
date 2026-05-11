// Magic-invite landing page — Stage 16.
//
// Flow:
//   1. Server component fetches assignment via public.skb_invite_lookup(token).
//      Anon key works because the wrapper is SECURITY DEFINER + token-gated.
//   2. If token invalid / expired / already-registered → render an error card.
//   3. Otherwise fire-and-forget public.skb_invite_mark_clicked(token), then
//      render <InviteForm> (client) which handles signUp + link.
//
// Compatibility: /sign-in remains intact for admins and direct logins.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, type InviteLookup } from "./invite-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic"; // never cache — token-gated content

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  // 0. Fast-fail for malformed UUIDs (no DB round trip).
  if (!UUID_RE.test(params.token)) {
    return <ErrorCard kind="invalid_format" />;
  }

  // 1. Lookup via SECURITY DEFINER wrapper (anon-callable).
  const supabase = createClient();
  const { data, error } = await supabase.rpc("skb_invite_lookup", {
    p_token: params.token,
  });

  if (error) {
    console.error("invite lookup failed:", error);
    return <ErrorCard kind="server_error" />;
  }
  if (!data) {
    return <ErrorCard kind="not_found" />;
  }

  const info = data as InviteLookup;
  if (info.expired) {
    return <ErrorCard kind="expired" expiresAt={info.expires_at} />;
  }

  // 2. Fire-and-forget click tracker (don't block render).
  //    Errors are swallowed — the click flag is nice-to-have analytics.
  void supabase.rpc("skb_invite_mark_clicked", { p_token: params.token });

  // 3. Already registered? Send them to sign-in with a next= pointing to wizard.
  if (info.already_registered) {
    return <AlreadyRegisteredCard info={info} />;
  }

  return <InviteForm token={params.token} info={info} />;
}

// ───────────────────────────────────────────────────────────────────

function ErrorCard({
  kind,
  expiresAt,
}: {
  kind: "invalid_format" | "not_found" | "expired" | "server_error";
  expiresAt?: string;
}) {
  const text = {
    invalid_format: {
      title: "ลิงก์ไม่ถูกต้อง",
      body: "ดูเหมือนลิงก์จะพิมพ์ผิดหรือถูกตัด ลองเปิดจาก LINE ที่บอทส่งมาอีกครั้ง",
    },
    not_found: {
      title: "ไม่พบลิงก์นี้ในระบบ",
      body: "ลิงก์อาจถูกยกเลิกแล้ว หรือยังไม่ได้สร้าง — ติดต่อ Boss / บังซิ เพื่อขอลิงก์ใหม่",
    },
    expired: {
      title: "ลิงก์หมดอายุแล้ว",
      body: `ลิงก์นี้หมดอายุเมื่อ ${
        expiresAt ? new Date(expiresAt).toLocaleString("th-TH") : "—"
      } ติดต่อ Boss / บังซิ เพื่อขอลิงก์ใหม่`,
    },
    server_error: {
      title: "ระบบขัดข้องชั่วคราว",
      body: "ลองรีโหลดหน้านี้อีกครั้งใน 1-2 นาที — ถ้ายังไม่ได้ติดต่อ Boss",
    },
  }[kind];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
          ⚠️
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-800">{text.title}</h1>
        <p className="text-sm text-slate-600">{text.body}</p>
        <div className="mt-6">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            ← ไปหน้าเข้าสู่ระบบปกติ
          </Link>
        </div>
      </div>
    </main>
  );
}

function AlreadyRegisteredCard({ info }: { info: InviteLookup }) {
  const next = `/wizard?project=${info.project_id}&assignment=${info.assignment_id}`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-cyan-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✅
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-800">
          คุณสมัครและผูกบัญชีเรียบร้อยแล้ว
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          {info.assignee_name ? `คุณ${info.assignee_name} ` : ""}เข้าสู่ระบบเพื่อกรอกข้อมูล{" "}
          <strong>{info.project_code}</strong> ต่อได้เลยครับ
        </p>
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="block w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark"
        >
          → เข้าสู่ระบบเพื่อทำต่อ
        </Link>
        <p className="mt-4 text-xs text-slate-500">
          ลืมรหัสผ่าน?{" "}
          <Link href="/sign-in" className="text-brand-primary hover:underline">
            ใช้ Magic Link
          </Link>
        </p>
      </div>
    </main>
  );
}
