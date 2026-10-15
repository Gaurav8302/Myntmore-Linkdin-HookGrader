import { AppConfig } from "../config.js";
import { ZohoClient } from "./zoho.js";
import {
  getZohoAccessSession,
  zohoOAuthConfigured,
  type ZohoOAuthConfig,
} from "./zohoAuth.js";

export function zohoOAuthFromConfig(config: AppConfig): ZohoOAuthConfig | null {
  if (
    !zohoOAuthConfigured({
      clientId: config.zohoClientId,
      clientSecret: config.zohoClientSecret,
      refreshToken: config.zohoRefreshToken,
      accessToken: config.zohoAccessToken,
    })
  ) {
    return null;
  }
  // Refresh path preferred; static access token alone still works for short tests.
  if (
    config.zohoClientId &&
    config.zohoClientSecret &&
    config.zohoRefreshToken
  ) {
    return {
      accountsUrl: config.zohoAccountsUrl,
      clientId: config.zohoClientId,
      clientSecret: config.zohoClientSecret,
      refreshToken: config.zohoRefreshToken,
      accessToken: config.zohoAccessToken,
      accessTokenExpiresAt: config.zohoAccessTokenExpiresAt,
      apiDomain: config.zohoApiDomain,
    };
  }
  if (config.zohoAccessToken) {
    return {
      accountsUrl: config.zohoAccountsUrl,
      clientId: config.zohoClientId || "static",
      clientSecret: config.zohoClientSecret || "static",
      refreshToken: "",
      accessToken: config.zohoAccessToken,
      accessTokenExpiresAt:
        config.zohoAccessTokenExpiresAt ??
        Math.floor(Date.now() / 1000) + 3600,
      apiDomain: config.zohoApiDomain,
    };
  }
  return null;
}

/**
 * Build a ZohoClient for live pipeline use. Refreshes access token only when expired.
 */
export async function resolveZohoClient(
  config: AppConfig,
): Promise<ZohoClient | undefined> {
  if (config.pipelineMode !== "live") return undefined;
  const oauth = zohoOAuthFromConfig(config);
  if (!oauth) return undefined;

  // Static-only (no refresh token): use access token as-is.
  if (!oauth.refreshToken && oauth.accessToken) {
    return {
      apiDomain: (oauth.apiDomain || config.zohoApiDomain).replace(/\/+$/, ""),
      accessToken: oauth.accessToken,
      fromEmail: config.zohoFromEmail,
    };
  }

  const session = await getZohoAccessSession(oauth);
  return {
    apiDomain: session.apiDomain,
    accessToken: session.accessToken,
    fromEmail: config.zohoFromEmail,
  };
}
