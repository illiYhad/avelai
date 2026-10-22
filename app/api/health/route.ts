// health check — ห้ามคืนค่า env ใด ๆ
export function GET() {
  return Response.json({ ok: true, phase: "0" });
}
