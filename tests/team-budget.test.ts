import { describe, expect, it } from "vitest";
import { computeMonthlyTotals, itemCountsInMonth, type BudgetItem } from "@/lib/team/budget";

const item = (over: Partial<BudgetItem>): BudgetItem => ({
  item_type: "EXPENSE",
  amount_thb: 100,
  recurring_monthly: false,
  effective_month: "2026-10-01",
  ...over,
});

describe("itemCountsInMonth", () => {
  it("รายการครั้งเดียวนับเฉพาะเดือนตัวเอง", () => {
    expect(itemCountsInMonth(item({}), "2026-10")).toBe(true);
    expect(itemCountsInMonth(item({}), "2026-11")).toBe(false);
    expect(itemCountsInMonth(item({}), "2026-09")).toBe(false);
  });

  it("รายการรายเดือนนับตั้งแต่เดือนที่ตั้งเป็นต้นไป", () => {
    const r = item({ recurring_monthly: true, effective_month: "2026-09-01" });
    expect(itemCountsInMonth(r, "2026-08")).toBe(false);
    expect(itemCountsInMonth(r, "2026-09")).toBe(true);
    expect(itemCountsInMonth(r, "2027-01")).toBe(true);
  });
});

describe("computeMonthlyTotals", () => {
  it("แยกเงินเดือน/ค่าใช้จ่าย/รายรับ และคำนวณคงเหลือถูกต้อง", () => {
    const items: BudgetItem[] = [
      item({ item_type: "SALARY", amount_thb: 12000, recurring_monthly: true, effective_month: "2026-09-01" }),
      item({ item_type: "SALARY", amount_thb: 10000, recurring_monthly: true, effective_month: "2026-10-01" }),
      item({ item_type: "EXPENSE", amount_thb: 5000 }), // 2026-10 ครั้งเดียว
      item({ item_type: "EXPENSE", amount_thb: 999, effective_month: "2026-11-01" }), // เดือนอื่น
      item({ item_type: "INCOME", amount_thb: 30000 }),
    ];
    const t = computeMonthlyTotals(items, "2026-10");
    expect(t.salaryTotal).toBe(22000);
    expect(t.expenseTotal).toBe(5000);
    expect(t.incomeTotal).toBe(30000);
    expect(t.totalOut).toBe(27000);
    expect(t.net).toBe(3000);
  });

  it("เดือนที่ไม่มีรายการ = ศูนย์ทุกช่อง", () => {
    const t = computeMonthlyTotals([], "2026-10");
    expect(t).toEqual({ salaryTotal: 0, expenseTotal: 0, incomeTotal: 0, totalOut: 0, net: 0 });
  });

  it("ค่าใช้จ่ายมากกว่ารายรับ = คงเหลือติดลบ", () => {
    const t = computeMonthlyTotals(
      [item({ item_type: "SALARY", amount_thb: 50000 }), item({ item_type: "INCOME", amount_thb: 20000 })],
      "2026-10",
    );
    expect(t.net).toBe(-30000);
  });
});
