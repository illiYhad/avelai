import { NextResponse, type NextRequest } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function proxy(_request: NextRequest) {
  // ปล่อยผ่านทุก Request ไม่ให้ติด Guard จนเกิด 500 บน Runtime
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};