"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fmtTHB } from "@/lib/utils";

const PROJECT_TYPES = [
  { value: "government", label: "งานภาครัฐ" },
  { value: "private", label: "งานเอกชน" },
  { value: "other", label: "อื่นๆ" },
];

interface Employee { id: string; full_name: string; role_code: string; }

export default function WizardStep1() {
  const supabase = createClient();
  const [tab, setTab] = useState<"1A" | "1B">("1A");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectCode, setProjectCode] = useState<string | null>(null);

  // Tab 1A — project info
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("government");
  const [clientName, setClientName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [siteManagerId, setSiteManagerId] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");

  // Tab 1B — contract
  const [contractNo, setContractNo] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [budgetEstimate, setBudgetEstimate] = useState("");
  const [intakeDeadline, setIntakeDeadline] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load employees for dropdown
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, role_code")
        .eq("company_id", "SKY001")
        .eq("is_approved", true)
        .order("full_name");
      if (error) {
        toast.error("โหลดพนักงานไม่ได้: " + error.message);
        return;
      }
      if (data) setEmployees(data as Employee[]);
    })();
  }, [supabase]);

  function extractLatLng(url: string): { lat?: number; lng?: number } {
    const patterns = [
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
      /(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    }
    return {};
  }

  async function handleSave() {
    const missing: string[] = [];
    if (!projectName) missing.push("ชื่อโครงการ");
    if (!clientName) missing.push("ชื่อหน่วยงาน");
    if (!locationAddress) missing.push("สถานที่โครงการ");
    if (!siteManagerId) missing.push("Site Manager");
    if (!projectManagerId) missing.push("วิศวกรผู้รับผิดชอบ");
    if (!contractNo) missing.push("เลขที่สัญญา");
    if (!contractValue || Number(contractValue) <= 0) missing.push("มูลค่าสัญญา");
    if (!startDate) missing.push("วันที่เริ่มสัญญา");
    if (!endDate) missing.push("วันที่สิ้นสุดสัญญา");
    if (missing.length) {
      toast.error(`ยังขาด: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    const { lat, lng } = extractLatLng(mapsUrl);
    const { data: userData } = await supabase.auth.getUser();
    const { data: meEmp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userData.user?.id ?? "")
      .maybeSingle() as { data: { id: string } | null };

    const { data, error } = await supabase
      .from("skb_projects")
      .insert({
        company_id: "SKY001",
        project_name: projectName,
        project_type: projectType,
        client_name: clientName,
        contract_no: contractNo,
        contract_value: Number(contractValue),
        budget_estimate: budgetEstimate ? Number(budgetEstimate) : 0,
        start_date: startDate,
        end_date: endDate,
        intake_deadline: intakeDeadline || null,
        location_address: locationAddress,
        location_lat: lat ?? null,
        location_lng: lng ?? null,
        site_manager_id: siteManagerId,
        project_manager_id: projectManagerId,
        intake_status: "draft",
        created_by: meEmp?.id ?? null,
      })
      .select("id, project_code")
      .single() as { data: { id: string; project_code: string } | null; error: { message: string } | null };

    setLoading(false);
    if (error) {
      toast.error("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    if (data) {
      setProjectCode(data.project_code);
      toast.success(`สร้างโครงการ ${data.project_code} สำเร็จ — Step 2 (งวดงาน) กำลังพัฒนา`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between">
          {["ข้อมูลโครงการ", "งวดงาน + Gantt", "BOQ วัสดุ", "BOQ ค่าแรง", "ทีมงาน"].map((label, i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-brand-primary text-white ring-4 ring-brand-primary/20" : "bg-slate-200 text-slate-500"}`}>{i + 1}</div>
              <span className={`hidden text-sm md:inline ${i === 0 ? "font-semibold text-brand-primary" : "text-slate-500"}`}>{label}</span>
              {i < 4 && <div className="h-0.5 flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Helpful banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">📝 วิธีกรอกฟอร์มนี้</p>
        <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed">
          <li>ฟิลด์ที่มีดอกจัน <span className="text-rose-500">*</span> คือฟิลด์บังคับ — ครบทุกช่องระบบจึงจะให้บันทึกได้</li>
          <li>กรอก Tab "ข้อมูลโครงการ" และ "ข้อมูลสัญญา" ทั้ง 2 — กดปุ่มสีน้ำเงินด้านล่าง Tab 2 เพื่อสร้างโครงการ</li>
          <li>ข้อมูลที่กรอกจะ sync เข้า Supabase ทันที ระบบจะ generate รหัสโครงการ <code className="rounded bg-white/60 px-1">SKB-26-XXX</code> ให้อัตโนมัติ</li>
        </ul>
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary text-xl">🏢</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Step 1 · ข้อมูลโครงการ</h2>
            <p className="text-xs text-slate-500">2 หัวข้อย่อย — กรอกได้ทั้ง 2 tab จะ validate ตอนกด "บันทึก"</p>
          </div>
          {projectCode && (
            <span className="ml-auto rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
              ✓ {projectCode}
            </span>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button onClick={() => setTab("1A")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === "1A" ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            ● ข้อมูลโครงการ
          </button>
          <button onClick={() => setTab("1B")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === "1B" ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            ○ ข้อมูลสัญญา
          </button>
        </div>

        {tab === "1A" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="ชื่อโครงการ *"
              hint="ชื่อเต็มตามเอกสารสัญญา ใช้ภาษาไทยได้ — เช่น 'ก่อสร้างอาคาร อบต.บันนังสาเรง'"
              className="md:col-span-2"
            >
              <Input value={projectName} onChange={setProjectName} placeholder="เช่น ก่อสร้างอาคาร อบต.บันนังสาเรง" />
            </Field>
            <Field
              label="ประเภทโครงการ *"
              hint="ภาครัฐ = อบต., เทศบาล, สนง.เขตพื้นที่ฯ · เอกชน = บริษัท, บุคคล"
            >
              <select value={projectType} onChange={e => setProjectType(e.target.value)} className={inputCls}>
                {PROJECT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field
              label="ชื่อหน่วยงานเจ้าของงาน *"
              hint="ชื่อหน่วยงาน/บริษัทผู้ว่าจ้าง ตามที่ระบุในสัญญา"
            >
              <Input value={clientName} onChange={setClientName} placeholder="อบต.บันนังสาเรง / สนง.เขตพื้นที่ฯ" />
            </Field>
            <Field
              label="สถานที่โครงการ (ที่อยู่เต็ม) *"
              hint="ที่อยู่เต็ม: เลขที่ + หมู่ + ตำบล + อำเภอ + จังหวัด — ใช้สำหรับ HR check-in GPS หน้างาน"
              className="md:col-span-2"
            >
              <textarea value={locationAddress} onChange={e => setLocationAddress(e.target.value)} rows={2} placeholder="เลขที่... หมู่... ตำบล... อำเภอ... จังหวัด..." className={inputCls} />
            </Field>
            <Field
              label="📍 พิกัด GPS — paste link Google Maps"
              hint="เปิด Google Maps ค้นหาสถานที่ → กดปุ่ม 'แชร์' → คัดลอกลิงก์ → paste ที่นี่ ระบบจะดึง lat/lng ให้อัตโนมัติ"
              className="md:col-span-2"
            >
              <Input value={mapsUrl} onChange={setMapsUrl} placeholder="https://maps.google.com/?q=13.7563,100.5018" />
              {(() => {
                const r = extractLatLng(mapsUrl);
                if (r.lat) return <p className="mt-1 text-xs text-emerald-600">✓ Latitude: <b>{r.lat}</b> · Longitude: <b>{r.lng}</b></p>;
                if (mapsUrl) return <p className="mt-1 text-xs text-rose-600">⚠️ ไม่พบ lat/lng ใน URL — ลอง copy link จากเมนู &quot;Share&quot; ของ Google Maps</p>;
                return null;
              })()}
            </Field>
            <Field
              label="Site Manager *"
              hint={employees.length === 0
                ? "⚠️ ยังไม่มีพนักงานในระบบ — ติดต่อ admin ให้เพิ่มพนักงานก่อน หรือไป /admin/employees"
                : "หัวหน้าคุมงานหน้าโครงการ (Foreman ขึ้น) — เลือกจากพนักงานที่ admin อนุมัติแล้ว"}
            >
              <select value={siteManagerId} onChange={e => setSiteManagerId(e.target.value)} className={inputCls}>
                <option value="">{employees.length === 0 ? "— ไม่มีพนักงานในระบบ —" : "— เลือก —"}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.role_code})</option>)}
              </select>
            </Field>
            <Field
              label="วิศวกรผู้รับผิดชอบ *"
              hint="วิศวกรหลักที่ดูแลโครงการนี้ — มักเป็นผู้ที่เซ็นสัญญา"
            >
              <select value={projectManagerId} onChange={e => setProjectManagerId(e.target.value)} className={inputCls}>
                <option value="">{employees.length === 0 ? "— ไม่มีพนักงานในระบบ —" : "— เลือก —"}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.role_code})</option>)}
              </select>
            </Field>
            <div className="md:col-span-2 flex justify-end">
              <button onClick={() => setTab("1B")} className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark">
                ไปต่อ Tab 1B →
              </button>
            </div>
          </div>
        )}

        {tab === "1B" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="เลขที่สัญญา *"
              hint="เลขที่สัญญาตามเอกสาร เช่น '5/2568' หรือ 'อบต.บันนัง 12/2568'"
            >
              <Input value={contractNo} onChange={setContractNo} placeholder="เช่น 5/2568" />
            </Field>
            <Field
              label="มูลค่าสัญญา (บาท) *"
              hint="มูลค่ารวมตามสัญญา ใส่เฉพาะตัวเลข ไม่ต้องใส่ , หรือ ฿"
            >
              <Input value={contractValue} onChange={setContractValue} type="number" placeholder="19040000" />
              {contractValue && <p className="mt-1 text-xs text-brand-primary">฿{fmtTHB(contractValue)}</p>}
            </Field>
            <Field
              label="ประมาณการงบ (บาท)"
              hint="งบที่บริษัทประมาณว่าจะใช้จริง (ต้นทุน) — ใช้คำนวณกำไรประมาณการ ไม่บังคับ"
            >
              <Input value={budgetEstimate} onChange={setBudgetEstimate} type="number" placeholder="17000000" />
            </Field>
            <Field
              label="Deadline ที่จะกรอกข้อมูลนี้เสร็จ"
              hint="วันสุดท้ายที่ต้องกรอกฟอร์มทั้ง 5 step ให้ครบ — ใช้ส่งแจ้งเตือนวิศวกร"
            >
              <Input value={intakeDeadline} onChange={setIntakeDeadline} type="date" />
            </Field>
            <Field
              label="วันที่เริ่มสัญญา *"
              hint="วันแรกที่นับตามสัญญา (ไม่จำเป็นต้องเป็นวันเข้างานจริง)"
            >
              <Input value={startDate} onChange={setStartDate} type="date" />
            </Field>
            <Field
              label="วันที่สิ้นสุดสัญญา *"
              hint="วันสุดท้ายที่ต้องส่งมอบงานตามสัญญา"
            >
              <Input value={endDate} onChange={setEndDate} type="date" />
            </Field>
            <div className="md:col-span-2 flex items-center justify-between border-t border-slate-100 pt-4">
              <button onClick={() => setTab("1A")} className="text-sm text-slate-500 hover:text-slate-700">← กลับ Tab 1A</button>
              <button onClick={handleSave} disabled={loading} className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-60">
                {loading ? "กำลังบันทึก..." : "บันทึก & สร้างโครงการ"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        🚧 <b>Stage 7.3.A</b> — Step 1 พร้อมใช้งาน + sync ลง <code className="rounded bg-white px-1">skb_projects</code> ทันที
        Steps 2-5 (Milestones, BOQ, Team) + Admin sidebar กำลัง port ในรอบถัดไป
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">💡 {hint}</p>}
    </div>
  );
}

function Input({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <input value={value} onChange={e => onChange(e.target.value)} className={inputCls} {...rest} />;
}
