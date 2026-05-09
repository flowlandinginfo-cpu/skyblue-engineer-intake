// LINE Bot Monitor — Stage 15 (Cheap AI Routing observability)
// Boss + อาบู + บังซิ login → see real-time bot state
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";  // never cache; always live

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "-" : `$${Number(n).toFixed(4)}`;
const fmtTHB = (n: number | null | undefined) =>
  n == null ? "-" : `฿${Number(n).toFixed(2)}`;
const fmtNum = (n: number | null | undefined) =>
  n == null ? "-" : Number(n).toLocaleString();
const fmtTime = (s: string | null | undefined) => {
  if (!s) return "-";
  const d = new Date(s);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

async function refreshAction() {
  "use server";
  revalidatePath("/admin/monitor");
}

export default async function MonitorPage() {
  const supabase = createClient();

  // Run all queries in parallel
  const [
    monthSummary,
    todayUsage,
    activeSessions,
    chaseQueue,
    recentMessages,
    recentErrors,
    employeeCounts,
    routingRules,
  ] = await Promise.all([
    supabase.from("skb_ai_usage_monthly_summary").select("*").limit(3),
    supabase.from("skb_ai_usage_daily").select("*").gte("day", new Date().toISOString().slice(0,10)).limit(20),
    supabase.from("skb_pm_intake_sessions")
      .select("id, pm_employee_id, state, current_index, followup_count, last_followup_at, updated_at, employees(full_name, employee_code)")
      .not("state", "in", "(idle,done,abandoned)")
      .order("updated_at", { ascending: false }).limit(10),
    supabase.from("skb_chase_tasks")
      .select("id, task_type, target_employee_id, run_count, max_runs, next_run_at, status, employees(full_name, employee_code)")
      .eq("status", "active")
      .order("next_run_at").limit(10),
    supabase.from("skb_chat_messages")
      .select("id, line_user_id, direction, message_type, content, created_at, employees(full_name, employee_code)")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("skb_ai_usage")
      .select("id, task_type, provider, model, error, created_at")
      .not("error", "is", null)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("employees")
      .select("line_user_id, line_role_tag, is_approved")
      .eq("company_id", "SKY001"),
    supabase.from("skb_routing_rules").select("*", { count: "exact", head: true }).eq("active", true),
  ]);

  const totalEmps = (employeeCounts.data || []).length;
  const linkedEmps = (employeeCounts.data || []).filter((e: { line_user_id: string|null }) => e.line_user_id).length;
  const pctLinked = totalEmps ? Math.round((linkedEmps / totalEmps) * 100) : 0;

  const month = (monthSummary.data?.[0] || {}) as Record<string, unknown>;
  const todayCalls = (todayUsage.data || []).reduce((s: number, r: { calls?: number }) => s + (r.calls || 0), 0);
  const todayCost = (todayUsage.data || []).reduce((s: number, r: { cost_usd?: number }) => s + Number(r.cost_usd || 0), 0);
  const todayCached = (todayUsage.data || []).reduce((s: number, r: { cached_calls?: number }) => s + (r.cached_calls || 0), 0);
  const pctRuleOnly = todayCalls ? Math.round((todayCached / todayCalls) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📊 LINE Bot Monitor</h1>
          <p className="text-sm text-slate-500">Real-time observability • AI cost tracking • Active sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh intervalSec={30} />
          <form action={refreshAction}>
            <button type="submit" className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark">
              🔄 Refresh now
            </button>
          </form>
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="พนักงาน Linked"
          value={`${linkedEmps} / ${totalEmps}`}
          sub={`${pctLinked}%`}
          color={pctLinked >= 90 ? "emerald" : pctLinked >= 60 ? "amber" : "rose"}
        />
        <KpiCard
          label="AI Calls วันนี้"
          value={fmtNum(todayCalls)}
          sub={`${pctRuleOnly}% rule-only`}
          color="brand"
        />
        <KpiCard
          label="Cost วันนี้"
          value={fmtMoney(todayCost)}
          sub={fmtTHB(todayCost * 35.5)}
          color={todayCost > 1 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Active Sessions"
          value={fmtNum(activeSessions.data?.length)}
          sub={`+ ${fmtNum(chaseQueue.data?.length)} เตือน`}
          color="brand"
        />
      </div>

      {/* Monthly cost summary */}
      <Section title="💰 Cost รายเดือน (ล่าสุด 3 เดือน)">
        {monthSummary.data && monthSummary.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">เดือน</th>
                  <th className="px-3 py-2 text-right">Total Calls</th>
                  <th className="px-3 py-2 text-right">Rule-Only</th>
                  <th className="px-3 py-2 text-right">GPT-4o</th>
                  <th className="px-3 py-2 text-right">Haiku</th>
                  <th className="px-3 py-2 text-right">Sonnet</th>
                  <th className="px-3 py-2 text-right">Cost USD</th>
                  <th className="px-3 py-2 text-right">Cost THB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(monthSummary.data as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-xs">{String(row.month).slice(0,10)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(row.total_calls as number)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{fmtNum(row.rule_only_calls as number)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(row.gpt4o_mini_calls as number)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(row.haiku_calls as number)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(row.sonnet_calls as number)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMoney(row.total_cost_usd as number)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{fmtTHB(Number(row.total_cost_usd || 0) * 35.5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="ยังไม่มี data — รัน migration v3.0.1 + ใช้งาน 1 วันค่อยเห็น" />
        )}
      </Section>

      {/* Active PM intake sessions */}
      <Section title="🎯 Active PM Intake Sessions">
        {activeSessions.data && activeSessions.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">PM</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2 text-right">Step</th>
                  <th className="px-3 py-2 text-right">Followups</th>
                  <th className="px-3 py-2 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeSessions.data as Array<{ id: string; state: string; current_index: number; followup_count: number; updated_at: string; employees: { full_name?: string; employee_code?: string } | null }>).map(s => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.employees?.full_name || "?"}</div>
                      <div className="text-xs text-slate-400">{s.employees?.employee_code}</div>
                    </td>
                    <td className="px-3 py-2"><StateBadge state={s.state} /></td>
                    <td className="px-3 py-2 text-right">#{s.current_index}</td>
                    <td className="px-3 py-2 text-right">{s.followup_count}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">{fmtTime(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="ไม่มี session active — บังซิยังไม่เริ่ม flow ใหม่" />
        )}
      </Section>

      {/* Chase task queue */}
      <Section title="⏰ Chase Tasks (Scheduled Reminders)">
        {chaseQueue.data && chaseQueue.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2 text-right">Run / Max</th>
                  <th className="px-3 py-2 text-right">Next Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(chaseQueue.data as Array<{ id: string; task_type: string; run_count: number; max_runs: number; next_run_at: string; employees: { full_name?: string; employee_code?: string } | null }>).map(t => (
                  <tr key={t.id}>
                    <td className="px-3 py-2">
                      <code className="rounded bg-slate-100 px-1 text-xs">{t.task_type}</code>
                    </td>
                    <td className="px-3 py-2">
                      {t.employees?.full_name ? (
                        <>
                          <div>{t.employees.full_name}</div>
                          <div className="text-xs text-slate-400">{t.employees.employee_code}</div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{t.run_count} / {t.max_runs}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">{fmtTime(t.next_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="ไม่มี chase task เลย" />
        )}
      </Section>

      {/* Recent messages */}
      <Section title="💬 Recent Messages (Last 20)">
        {recentMessages.data && recentMessages.data.length > 0 ? (
          <div className="space-y-2">
            {(recentMessages.data as Array<{ id: string; line_user_id: string; direction: string; message_type: string; content: string|null; created_at: string; employees: { full_name?: string; employee_code?: string } | null }>).map(m => (
              <div key={m.id} className="flex gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className={`shrink-0 ${m.direction === "inbound" ? "text-blue-600" : "text-emerald-600"}`}>
                  {m.direction === "inbound" ? "↘" : "↗"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-slate-700">
                      {m.employees?.full_name || `${m.line_user_id.slice(0,10)}…`}
                    </span>
                    <code className="rounded bg-slate-100 px-1 text-[10px]">{m.message_type}</code>
                    <span className="text-slate-400">{fmtTime(m.created_at)}</span>
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-600">
                    {m.content || <em className="text-slate-400">(no text)</em>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="ยังไม่มี chat — รอบอท receive message" />
        )}
      </Section>

      {/* Errors (last 7 days) */}
      <Section title="⚠️ AI Errors (Last 7 Days)">
        {recentErrors.data && recentErrors.data.length > 0 ? (
          <div className="space-y-2">
            {(recentErrors.data as Array<{ id: string; task_type: string; provider: string; model: string|null; error: string; created_at: string }>).map(e => (
              <div key={e.id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-xs">
                  <code className="rounded bg-rose-100 px-1 text-rose-700">{e.task_type}</code>
                  <span className="text-slate-500">{e.provider}/{e.model || "?"}</span>
                  <span className="ml-auto text-slate-400">{fmtTime(e.created_at)}</span>
                </div>
                <div className="mt-1 truncate text-xs text-rose-700">{e.error}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✅ ไม่มี error ใน 7 วันที่ผ่านมา
          </div>
        )}
      </Section>

      {/* Footer info */}
      <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
        <p><strong>Routing rules ใน DB:</strong> {fmtNum(routingRules.count || 0)} rules</p>
        <p className="mt-1">
          📋 Cost ที่เห็นเป็น <em>USD</em>; THB ประมาณ × 35.5.
          Refresh หน้าทุก ~30s แนะนำ. Auto-refresh เพิ่มได้ภายหลัง.
        </p>
      </div>
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: "emerald"|"amber"|"rose"|"brand" }) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    brand: "border-brand-primary/20 bg-brand-primary/5",
  };
  return (
    <div className={`rounded-2xl border-2 ${colors[color]} p-4`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <h2 className="mb-3 text-base font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">{text}</p>;
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { color: string; label: string }> = {
    asking_active_list: { color: "bg-blue-100 text-blue-700", label: "📝 รอ list" },
    confirming_codes: { color: "bg-amber-100 text-amber-700", label: "✋ รอยืนยัน codes" },
    asking_priority: { color: "bg-purple-100 text-purple-700", label: "🔢 รอ priority" },
    asking_deadline: { color: "bg-orange-100 text-orange-700", label: "📅 รอ deadline" },
    asking_assignee: { color: "bg-pink-100 text-pink-700", label: "👤 รอ assignee" },
  };
  const cfg = map[state] || { color: "bg-slate-100 text-slate-600", label: state };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}
