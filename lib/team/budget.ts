// ตรรกะคำนวณงบทีมรายเดือน (pure — เทสด้วย vitest · K-AV-R เฟส 3 ข้อ 12)

export interface BudgetItem {
  item_type: "SALARY" | "EXPENSE" | "INCOME";
  amount_thb: number;
  recurring_monthly: boolean;
  effective_month: string; // YYYY-MM-DD (วันแรกของเดือน)
}

export interface MonthlyTotals {
  salaryTotal: number;
  expenseTotal: number; // ไม่รวมเงินเดือน
  incomeTotal: number;
  totalOut: number; // salary + expense
  net: number; // income - totalOut
}

/** รายการนับเข้าเดือน month (YYYY-MM) เมื่อ:
 *  - effective_month อยู่เดือนนั้นพอดี หรือ
 *  - recurring_monthly = true และ effective_month <= เดือนนั้น (เริ่มคิดตั้งแต่เดือนที่ตั้ง) */
export function itemCountsInMonth(item: BudgetItem, month: string): boolean {
  const itemMonth = item.effective_month.slice(0, 7);
  if (item.recurring_monthly) return itemMonth <= month;
  return itemMonth === month;
}

export function computeMonthlyTotals(items: BudgetItem[], month: string): MonthlyTotals {
  let salaryTotal = 0;
  let expenseTotal = 0;
  let incomeTotal = 0;
  for (const item of items) {
    if (!itemCountsInMonth(item, month)) continue;
    const amt = Number(item.amount_thb) || 0;
    if (item.item_type === "SALARY") salaryTotal += amt;
    else if (item.item_type === "EXPENSE") expenseTotal += amt;
    else incomeTotal += amt;
  }
  const totalOut = salaryTotal + expenseTotal;
  return { salaryTotal, expenseTotal, incomeTotal, totalOut, net: incomeTotal - totalOut };
}
