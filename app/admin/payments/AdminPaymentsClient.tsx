"use client";

import { DecisionForm } from "@/components/tournaments/ui";
import type { AdminPayState } from "./actions";

export function PassReview({ review }: { review: (decision: "VERIFIED" | "REJECTED", reason: string) => Promise<AdminPayState> }) {
  return <DecisionForm review={review} />;
}
