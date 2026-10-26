import "server-only";
import QRCode from "qrcode";

// K-AV-3: วาด QR เป็น SVG ฝั่ง server ด้วย qrcode@1.5.4 (ไม่ยิงเครือข่าย · ไม่ใช้บริการภายนอก)
export async function promptPayQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 240 });
}
