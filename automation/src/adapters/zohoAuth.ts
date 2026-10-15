/**
 * Zoho OAuth access-token helper (refresh-token flow).
 * Never logs token values. Access tokens are cached in-memory until near expiry.
 */

export interface ZohoOAuthConfig {
  accountsUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Optional warm access token from env; used until expiry. */
  accessToken?: string;
  /** Unix seconds; refresh when now >= expiresAt. */
  accessTokenExpiresAt?: number;
  /** Fallback API domain before first token response. */
  apiDomain?: string;
  fetchImpl?: typeof fetch;
}

export interface ZohoAccessSession {
  accessToken: string;
  apiDomain: string;
  /** Unix seconds when this access token should be treated as expired. */
  expiresAt: number;
  /** True when this call performed a refresh against Accounts. */
  refreshed: boolean;
}

interface TokenResponse {
  access_token?: string;
  api_domain?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

type CacheKey = string;

const sessionCache = new Map<CacheKey, ZohoAccessSession>();

function cacheKey(cfg: ZohoOAuthConfig): CacheKey {
  return `${cfg.accountsUrl}|${cfg.clientId}|${cfg.refreshToken.slice(0, 8)}`;
}

function accountsBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Refresh access token via Zoho Accounts OAuth.
 * POST {accounts}/oauth/v2/token?grant_type=refresh_token&...
 */
export async function refreshZohoAccessToken(
  cfg: ZohoOAuthConfig,
): Promise<ZohoAccessSession> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
  });
  const url = `${accountsBase(cfg.accountsUrl)}/oauth/v2/token?${params.toString()}`;
  const res = await fetchImpl(url, { method: "POST" });
  const text = await res.text();
  let json: TokenResponse;
  try {
    json = JSON.parse(text) as TokenResponse;
  } catch {
    throw new Error(`Zoho token refresh returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok || json.error || !json.access_token) {
    const code = json.error || `http_${res.status}`;
    // Never include raw body (may contain tokens in misconfigured proxies).
    throw new Error(`Zoho token refresh failed: ${code}`);
  }
  const expiresIn = Number(json.expires_in) || 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn - 60;
  const apiDomain = (json.api_domain || cfg.apiDomain || "https://www.zohoapis.in").replace(
    /\/+$/,
    "",
  );
  const session: ZohoAccessSession = {
    accessToken: json.access_token,
    apiDomain,
    expiresAt,
    refreshed: true,
  };
  sessionCache.set(cacheKey(cfg), { ...session, refreshed: false });
  return session;
}

/**
 * Return a usable access token. Reuses the current token until near expiry;
 * refreshes only when necessary (not once per lead).
 */
export async function getZohoAccessSession(
  cfg: ZohoOAuthConfig,
): Promise<ZohoAccessSession> {
  const key = cacheKey(cfg);
  const now = Math.floor(Date.now() / 1000);
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > now && cached.accessToken) {
    return { ...cached, refreshed: false };
  }

  if (
    cfg.accessToken &&
    cfg.accessTokenExpiresAt &&
    cfg.accessTokenExpiresAt > now
  ) {
    const warm: ZohoAccessSession = {
      accessToken: cfg.accessToken,
      apiDomain: (cfg.apiDomain || "https://www.zohoapis.in").replace(/\/+$/, ""),
      expiresAt: cfg.accessTokenExpiresAt,
      refreshed: false,
    };
    sessionCache.set(key, warm);
    return warm;
  }

  return refreshZohoAccessToken(cfg);
}

/** Test helper: clear in-memory token cache. */
export function clearZohoAccessSessionCache(): void {
  sessionCache.clear();
}

export function zohoOAuthConfigured(cfg: {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
}): boolean {
  const hasRefresh =
    !!cfg.clientId?.trim() &&
    !!cfg.clientSecret?.trim() &&
    !!cfg.refreshToken?.trim();
  const hasStatic = !!cfg.accessToken?.trim();
  return hasRefresh || hasStatic;
}
