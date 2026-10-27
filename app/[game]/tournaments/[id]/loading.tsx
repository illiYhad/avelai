import Skeleton, { SkeletonList } from "@/components/ui/Skeleton";

// K-AV-UX2A Phase B: โครงระหว่างโหลด
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-56" />
      <SkeletonList rows={3} />
    </main>
  );
}
