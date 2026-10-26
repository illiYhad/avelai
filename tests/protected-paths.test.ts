import { describe, it, expect } from "vitest";
import { needsLogin } from "@/lib/auth/protected-paths";

describe("needsLogin (K-AV-H2)", () => {
  it.each(["/me", "/me/dota", "/me/dota/", "/me/dota/match/123", "/tournaments/abc/register", "/tournaments/abc/receipt/p1", "/organizer", "/organizer/tournaments/new", "/pass", "/pass/receipt/p1", "/admin/payments", "/matches/abc", "/matches/abc/evidence", "/organizer/tournaments/x/matches", "/profile", "/teams/create", "/team/abc/schedule", "/team/abc/budget", "/team/abc/scout", "/me/", "/team/abc/scout/"])(
    "%s ต้องล็อกอิน",
    (p) => expect(needsLogin(p)).toBe(true),
  );
  it.each(["/", "/login", "/leaderboard", "/tournament", "/tournament/weekly", "/tournaments", "/tournaments/abc", "/teams", "/teams/abc", "/profile/abc", "/dashboard", "/api/health"])(
    "%s เปิดสาธารณะ",
    (p) => expect(needsLogin(p)).toBe(false),
  );
});
