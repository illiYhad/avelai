import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // โค้ด AVELAi เดิม (K-AV-R เฟส 0): ใบงานห้ามเปลี่ยนตรรกะ จึงลด no-explicit-any เป็น warn
    // เฉพาะไฟล์เดิมที่ค้าง any — โค้ดใหม่ทุกไฟล์ยังบังคับ error ตามปกติ
    files: [
      "app/api/dota/sync/route.ts",
      "app/api/v1/daily/settle-winner/route.ts",
      "app/api/v1/tournament/bracket/create-weekly/route.ts",
      "app/api/v1/tournament/bracket/report-result/route.ts",
      "app/api/v1/tournament/swiss/finalize-top8/route.ts",
      "app/api/v1/tournament/swiss/generate-pairing/route.ts",
      "app/leaderboard/page.tsx",
      "app/match-history/page.tsx",
      "app/match/\\[matchId\\]/page.tsx",
      "app/match/\\[matchId\\]/components/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
