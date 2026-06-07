/**
 * storeMode — Local Mode vs Cloud Mode runtime state.
 *
 * Architecture: "local-first with cloud sync" (Option B).
 *   - All reads/writes go through dataStore (IndexedDB + localStorage), unchanged.
 *   - In Cloud Mode, mutations are additionally pushed to the server in the
 *     background via lib/cloudSync.ts.
 *   - On Cloud Mode startup, the client pulls the full server snapshot and
 *     overwrites local — this is the cross-device sync hook (currently single-
 *     device, but the door is open).
 *
 * Cloud Mode requires both a configured base URL (build-time env or stored)
 * and a valid OWNER_TOKEN that the user enters once at `/owner`. If either is
 * missing or /health is unreachable, the app silently stays in Local Mode.
 */

const LS_TOKEN_KEY = "verdant:cloud:token";
const LS_BASE_KEY = "verdant:cloud:baseUrl";
const LS_ENABLED_KEY = "verdant:cloud:enabled"; // "1" once the user opted in

// Build-time default base URL (set NEXT_PUBLIC_VERDANT_API_BASE in Vercel env).
// Owner can override at runtime via the /owner page.
const DEFAULT_BASE =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_VERDANT_API_BASE ?? ""
    : "";

export type StoreMode = "local" | "cloud";

// In-memory cache so hot reads don't hit localStorage every time.
let _mode: StoreMode = "local";
let _token: string | null = null;
let _base: string | null = null;

// ─── Configuration accessors ──────────────────────────────────────────────────

export function getMode(): StoreMode {
  return _mode;
}

export function isCloudMode(): boolean {
  return _mode === "cloud";
}

export function getToken(): string | null {
  return _token;
}

export function getBaseUrl(): string | null {
  return _base;
}

// ─── Owner setup (called from /owner page) ────────────────────────────────────

/** Save the owner's token + base URL after a successful /auth/verify.
 *  Does NOT switch mode — call enableCloudMode() after. */
export function saveOwnerCredentials(baseUrl: string, token: string): void {
  if (typeof window === "undefined") return;
  const normalized = baseUrl.replace(/\/+$/, "");
  localStorage.setItem(LS_BASE_KEY, normalized);
  localStorage.setItem(LS_TOKEN_KEY, token);
  _base = normalized;
  _token = token;
}

export function clearOwnerCredentials(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_TOKEN_KEY);
  localStorage.removeItem(LS_BASE_KEY);
  localStorage.removeItem(LS_ENABLED_KEY);
  _token = null;
  _base = null;
  _mode = "local";
  window.dispatchEvent(new CustomEvent("verdant:modeChanged", { detail: "local" }));
}

export function enableCloudMode(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_ENABLED_KEY, "1");
  _mode = "cloud";
  window.dispatchEvent(new CustomEvent("verdant:modeChanged", { detail: "cloud" }));
}

// ─── Boot-time detection ──────────────────────────────────────────────────────

/** Load stored credentials + ping /health. If everything checks out, flip to
 *  Cloud Mode. Otherwise stay in Local Mode (silently — anonymous demo users
 *  must never see auth UI). Safe to call multiple times. */
export async function detectMode(): Promise<StoreMode> {
  if (typeof window === "undefined") return "local";

  const storedBase = localStorage.getItem(LS_BASE_KEY) ?? DEFAULT_BASE;
  const storedToken = localStorage.getItem(LS_TOKEN_KEY);
  const optedIn = localStorage.getItem(LS_ENABLED_KEY) === "1";

  _base = storedBase || null;
  _token = storedToken;

  // Anonymous demo visitor — never attempt cloud.
  if (!optedIn || !storedBase || !storedToken) {
    _mode = "local";
    return "local";
  }

  // Owner: try /health quickly. Tailscale can be slow when waking; cap at 4s.
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${storedBase}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      _mode = "cloud";
      window.dispatchEvent(new CustomEvent("verdant:modeChanged", { detail: "cloud" }));
      return "cloud";
    }
  } catch {
    // network error / Tailscale down / wrong URL → fall through
  }

  _mode = "local"; // graceful degradation; credentials stay so we retry next boot
  return "local";
}
