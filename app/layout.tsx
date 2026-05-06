import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sky Blue · Engineer Intake",
  description: "บันทึกข้อมูลโครงการก่อสร้าง — สำหรับวิศวกรของ Sky Blue Construction",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
