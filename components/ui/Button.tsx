import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// K-AV-POLISH เฟส 2: ปุ่มกลาง — ใช้ .btn-primary/.btn-ghost จาก globals.css (สูง ≥44px · โฟกัสเห็นชัด)
// primary = ทองไล่สี (การกระทำหลัก 1 ปุ่มต่อหน้า) · ghost = ขอบฟ้า (รอง)
type Variant = "primary" | "ghost";
const BASE = "rounded px-4 text-sm";
const VARIANT: Record<Variant, string> = { primary: "btn-primary", ghost: "btn-ghost" };

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${VARIANT[variant]} ${BASE} ${className}`} {...rest} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${VARIANT[variant]} ${BASE} ${className}`}>
      {children}
    </Link>
  );
}
