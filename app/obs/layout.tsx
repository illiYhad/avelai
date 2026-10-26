import { OBS_FONTS_HREF, OBS_FONT_BODY, OBS_FONT_DISPLAY, OBS_FONT_MONO } from "@/lib/obs/theme";

// K-AV-8: เลย์เอาต์จอ OBS — พื้นหลังโปร่งใสสำหรับ Browser Source · ซ่อนเมนู/แชทบอทของ root layout (แก้ layout.tsx/Navbar ไม่ได้ตามใบ)
// สาธารณะโดยตั้งใจ · ไม่มีข้อมูลส่วนตัวบนจอ (route อ่านผ่าน view obs_*_v เท่านั้น)
const css = `
html, body { background: transparent !important; margin: 0; }
body > *:not([data-obs-root]) { display: none !important; }
[data-obs-root] { display: block; min-height: 100dvh; background: var(--obs-page-bg, transparent); color: var(--obs-text, #fff); font-family: ${OBS_FONT_BODY}; }
.obs-display { font-family: ${OBS_FONT_DISPLAY}; letter-spacing: 0.04em; }
.obs-mono { font-family: ${OBS_FONT_MONO}; font-variant-numeric: tabular-nums; }
.obs-card { background: var(--obs-card-bg); border: 2px solid var(--obs-border); border-radius: 14px; }
.obs-accent { color: var(--obs-accent); }
.obs-muted { color: var(--obs-muted); }
.obs-win { color: var(--obs-accent); font-weight: 800; }
@keyframes obs-marquee { from { transform: translateX(100vw); } to { transform: translateX(-100%); } }
.obs-marquee { display: inline-flex; white-space: nowrap; animation: obs-marquee var(--obs-marquee-s, 30s) linear infinite; will-change: transform; }
@keyframes obs-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.obs-live-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: #ff3b3b; animation: obs-pulse 1.2s ease-in-out infinite; }
`;

export default function ObsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-obs-root>
      <link rel="stylesheet" href={OBS_FONTS_HREF} />
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </div>
  );
}
