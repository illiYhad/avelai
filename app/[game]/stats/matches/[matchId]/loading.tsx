import Skeleton, { SkeletonList } from "@/components/ui/Skeleton";

// K-AV-R2.3: โครงระหว่างโหลด (แบบเดียวกับ app/[game]/tournaments/loading.tsx · ไม่มีข้อความ ไม่ต้องแปล)
export default function Loading() {
  return (
    <main role="status" aria-busy="true" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-56" />
      <SkeletonList rows={3} />
    </main>
  );
}
