import { describe, expect, it, beforeEach } from "vitest";
import {
  clearZohoAccessSessionCache,
  getZohoAccessSession,
  refreshZohoAccessToken,
  zohoOAuthConfigured,
} from "../src/adapters/zohoAuth.js";

describe("zohoAuth refresh-token flow", () => {
  beforeEach(() => {
    clearZohoAccessSessionCache();
  });

  it("detects configured OAuth", () => {
    expect(
      zohoOAuthConfigured({
        clientId: "id",
        clientSecret: "secret",
        refreshToken: "refresh",
      }),
    ).toBe(true);
    expect(zohoOAuthConfigured({})).toBe(false);
  });

  it("reuses cached access token until expiry (no refresh call)", async () => {
    let refreshCalls = 0;
    const fetchImpl: typeof fetch = async () => {
      refreshCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: "access-1",
          api_domain: "https://www.zohoapis.in",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200 },
      );
    };
    const cfg = {
      accountsUrl: "https://accounts.zoho.in",
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
      fetchImpl,
    };
    const first = await getZohoAccessSession(cfg);
    const second = await getZohoAccessSession(cfg);
    expect(first.accessToken).toBe("access-1");
    expect(second.accessToken).toBe("access-1");
    expect(first.refreshed).toBe(true);
    expect(second.refreshed).toBe(false);
    expect(refreshCalls).toBe(1);
  });

  it("refreshes when warm token is expired", async () => {
    let refreshCalls = 0;
    const fetchImpl: typeof fetch = async () => {
      refreshCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: "access-new",
          api_domain: "https://www.zohoapis.in",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    };
    const session = await getZohoAccessSession({
      accountsUrl: "https://accounts.zoho.in",
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
      accessToken: "stale",
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) - 10,
      fetchImpl,
    });
    expect(session.accessToken).toBe("access-new");
    expect(session.refreshed).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  it("throws a safe error without echoing body on refresh failure", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "invalid_code" }), { status: 400 });
    await expect(
      refreshZohoAccessToken({
        accountsUrl: "https://accounts.zoho.in",
        clientId: "id",
        clientSecret: "secret",
        refreshToken: "bad",
        fetchImpl,
      }),
    ).rejects.toThrow(/invalid_code/);
  });
});
