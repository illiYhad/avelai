import { describe, it, expect } from "vitest";
import { needsLogin } from "@/lib/auth/protected-paths";

describe("needsLogin (K-AV-H2)", () => {
  it.each(["/me", "/me/dota", "/me/dota/", "/me/dota/match/123", "/profile", "/teams/create", "/team/abc/schedule", "/team/abc/budget", "/team/abc/scout", "/me/", "/team/abc/scout/"])(
    "%s ต้องล็อกอิน",
    (p) => expect(needsLogin(p)).toBe(true),
  );
  it.each(["/", "/login", "/leaderboard", "/tournament", "/tournament/weekly", "/teams", "/teams/abc", "/profile/abc", "/dashboard", "/api/health"])(
    "%s เปิดสาธารณะ",
    (p) => expect(needsLogin(p)).toBe(false),
  );
});
