import { ImageResponse } from "next/og";

// K-AV-R2.5: ภาพ OG 1200×630 · พื้นเข้ม · ไม่มีรูป/ฟอนต์ภายนอก
export const alt = "AVELAi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#07090E", gap: 24 }}>
        <div style={{ fontSize: 140, fontWeight: 800, color: "#C9A84C", letterSpacing: 12 }}>AVELAi</div>
        <div style={{ fontSize: 48, color: "#00D4FF", letterSpacing: 4 }}>Dota 2 Tournaments</div>
      </div>
    ),
    size,
  );
}
