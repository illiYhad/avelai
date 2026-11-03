import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { allowPublicMatchView } from "@/lib/dota/ip-rate-limit";

// K-AV-D3.1: ยามเดียวทั้งเส้นทาง /dota2/stats/matches/[matchId]
// - layout.tsx และทุก page.tsx ใต้เส้นทางนี้ต้องเรียก guardPublicMatchView() ก่อนอ่านข้อมูลแมตช์
// - cache() ของ React ทำให้หนึ่งคำขอนับเพดานครั้งเดียว แม้ layout กับ page เรียกทั้งคู่
// - นำทางระหว่างแท็บ (RSC render เฉพาะ page) ก็ยังผ่านยาม เพราะ page เรียกเอง
// - ถูกล็อก = ห้ามเรียก getMatchDetail · ไม่มีข้อมูลแมตช์ใน HTML และ RSC payload
export const guardPublicMatchView = cache(async (): Promise<boolean> => allowPublicMatchView(await headers()));

export const PUBLIC_MATCH_BLOCKED_MESSAGE = "เปิดหน้านี้บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
