import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// K-AV-POLISH เฟส 2: ช่องกรอกกลาง — .hud-input จาก globals.css (สูง ≥44px · โฟกัสขอบฟ้า · 14px)
// Field = ป้าย + ช่อง + คำอธิบาย/ข้อผิดพลาด (ข้อความไทย) · ไม่มี state ภายใน ใช้ได้ทั้ง form action และ client

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-mono text-xs tracking-[0.15em] text-ink-muted">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-lose">{error}</p> : hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`hud-input ${className}`} {...rest} />;
}

export function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`hud-input ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`hud-input min-h-28 ${className}`} {...rest} />;
}
