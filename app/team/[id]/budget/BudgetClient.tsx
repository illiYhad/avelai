"use client";

// UI งบทีมแบบ interactive: เลือกเดือน → ยอดรวมคำนวณใหม่ทันที (ตรรกะจาก lib/team/budget.ts)
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBudgetItemAction, deleteBudgetItemAction } from "./actions";
import { computeMonthlyTotals, itemCountsInMonth, type BudgetItem } from "@/lib/team/budget";

export interface BudgetItemView extends BudgetItem {
  id: string;
  category: string;
  label: string;
  member_username: string | null;
  note: string | null;
}

interface MemberOption {
  userId: string;
  username: string;
}

interface Props {
  teamId: string;
  items: BudgetItemView[];
  members: MemberOption[];
}

const CATEGORY_LABEL: Record<string, string> = {
  SALARY: "เงินเดือน",
  HOUSING: "ค่าที่พัก",
  TRAVEL: "ค่าเดินทาง",
  INTERNET: "ค่าเน็ต",
  EQUIPMENT: "อุปกรณ์",
  SPONSOR: "สปอนเซอร์",
  PRIZE: "เงินรางวัล",
  OTHER: "อื่น ๆ",
};

const fmt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export function BudgetClient({ teamId, items, members }: Props) {
  const router = useRouter();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(thisMonth);
  const [itemType, setItemType] = useState("EXPENSE");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => computeMonthlyTotals(items, month), [items, month]);
  const monthItems = useMemo(() => items.filter((i) => itemCountsInMonth(i, month)), [items, month]);

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("month", month);
    startTransition(async () => {
      const res = await addBudgetItemAction(teamId, formData);
      if ("error" in res) setError(res.error.message);
      else router.refresh();
    });
  }

  const inputCls =
    "rounded border border-white/15 bg-[#0A0A0F] px-2 py-1.5 text-xs text-white focus:border-[#00D4FF] focus:outline-none";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-neutral-400">
          เดือน
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} ml-2`} />
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-white/10 bg-[#12121A] p-3">
          <p className="text-[10px] font-mono text-neutral-500 uppercase">เงินเดือนรวม</p>
          <p className="text-lg font-bold mt-1">{fmt(totals.salaryTotal)} ฿</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#12121A] p-3">
          <p className="text-[10px] font-mono text-neutral-500 uppercase">ค่าใช้จ่ายอื่น</p>
          <p className="text-lg font-bold mt-1">{fmt(totals.expenseTotal)} ฿</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#12121A] p-3">
          <p className="text-[10px] font-mono text-neutral-500 uppercase">รายรับ</p>
          <p className="text-lg font-bold mt-1 text-emerald-400">{fmt(totals.incomeTotal)} ฿</p>
        </div>
        <div className={`rounded-lg border p-3 ${totals.net >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}>
          <p className="text-[10px] font-mono text-neutral-500 uppercase">คงเหลือ/เดือน</p>
          <p className={`text-lg font-bold mt-1 ${totals.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(totals.net)} ฿
          </p>
        </div>
      </div>

      <form onSubmit={onAdd} className="rounded-lg border border-white/10 bg-[#12121A] p-4 flex flex-col gap-2">
        <p className="font-mono text-xs font-bold tracking-wider text-[#00D4FF] uppercase">เพิ่มรายการ (เดือน {month})</p>
        <div className="flex flex-wrap gap-2">
          <select name="itemType" value={itemType} onChange={(e) => setItemType(e.target.value)} className={inputCls}>
            <option value="SALARY">เงินเดือน</option>
            <option value="EXPENSE">ค่าใช้จ่าย</option>
            <option value="INCOME">รายรับ</option>
          </select>
          <select name="category" className={inputCls} defaultValue="OTHER">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {itemType === "SALARY" && (
            <select name="memberUserId" className={inputCls}>
              <option value="">— เลือกสมาชิก —</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>@{m.username}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input name="label" required placeholder="ชื่อรายการ" className={`${inputCls} flex-1 min-w-36`} />
          <input name="amountThb" type="number" min={0} step="0.01" required placeholder="บาท" className={`${inputCls} w-28`} />
          <label className="text-xs text-neutral-400 flex items-center gap-1">
            <input type="checkbox" name="recurring" /> รายเดือน
          </label>
          <button type="submit" disabled={isPending} className="rounded bg-[#00D4FF] px-4 py-1.5 text-xs font-bold text-black disabled:opacity-50">
            {isPending ? "..." : "+ เพิ่ม"}
          </button>
        </div>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </form>

      <section>
        <h2 className="font-mono text-sm font-bold tracking-wider text-neutral-300 uppercase mb-3">
          รายการเดือนนี้ ({monthItems.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {monthItems.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-[#12121A] px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-bold truncate">
                  {i.label}
                  {i.member_username ? <span className="text-neutral-400"> · @{i.member_username}</span> : null}
                </p>
                <p className="text-neutral-500 mt-0.5">
                  {CATEGORY_LABEL[i.category] ?? i.category}
                  {i.recurring_monthly ? " · รายเดือน" : ""}
                  {i.note ? ` · ${i.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono font-bold ${i.item_type === "INCOME" ? "text-emerald-400" : "text-white"}`}>
                  {i.item_type === "INCOME" ? "+" : "-"}{fmt(Number(i.amount_thb))} ฿
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await deleteBudgetItemAction(teamId, i.id); router.refresh(); })}
                  className="text-neutral-500 hover:text-rose-400"
                  aria-label="ลบรายการ"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {monthItems.length === 0 && <li className="text-sm text-neutral-500">ยังไม่มีรายการในเดือนนี้</li>}
        </ul>
      </section>
    </div>
  );
}
