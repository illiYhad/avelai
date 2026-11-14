"use client";

import { useEffect } from "react";
import Link from "next/link";
import { dict } from "@/lib/i18n";

// K-AV-COMPLETE.1: error ระดับ root layout · Next ต้องมี <html><body> เอง · ไทย+อังกฤษคู่กัน · ไม่แสดงรายละเอียด error
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/global-error] digest", error.digest);
  }, [error]);
  const th = dict("th").errors;
  const en = dict("en").errors;
  return (
    <html lang="th">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07090E", color: "#fff", fontFamily: "sans-serif", textAlign: "center" }}>
        <main style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
          <p style={{ fontSize: 48, color: "#C9A84C", margin: 0, letterSpacing: "0.15em" }}>500</p>
          <h1 style={{ fontSize: 22, margin: 0 }}>{th.serverError}</h1>
          <p style={{ fontSize: 16, margin: 0, opacity: 0.8 }}>{en.serverError}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button type="button" onClick={() => reset()} style={{ background: "#C9A84C", color: "#000", border: 0, borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}>
              {th.tryAgain} / {en.tryAgain}
            </button>
            <Link href="/" style={{ border: "1px solid #C9A84C", color: "#C9A84C", borderRadius: 8, padding: "8px 20px", fontWeight: 700, textDecoration: "none" }}>
              {th.backHome} / {en.backHome}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
