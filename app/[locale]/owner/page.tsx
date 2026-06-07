"use client";

/**
 * /[locale]/owner — hidden entry point for the single owner to enable Cloud Mode.
 *
 * Not linked from anywhere in the UI. Demo visitors never see this. The owner
 * types the route by hand once per device:
 *   1. Paste API base URL (e.g. https://<host>.ts.net:8443) + OWNER_TOKEN.
 *   2. Test connection → POST /auth/verify.
 *   3. Save & enable → credentials persisted to localStorage, mode flips to cloud,
 *      and from then on every mutation auto-syncs (lib/cloudSync).
 *   4. Optional: one-shot push of current local data to the server (migration).
 *
 * Intentionally English-only and minimal — this is a developer tool, not a UI screen.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getBaseUrl,
  getToken,
  getMode,
  isCloudMode,
  saveOwnerCredentials,
  enableCloudMode,
  clearOwnerCredentials,
  detectMode,
} from "@/lib/storeMode";
import { pullFromServer, pushAllToServer, flushSync } from "@/lib/cloudSync";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "ok"; msg: string }
  | { kind: "error"; msg: string };

export default function OwnerPage() {
  const [base, setBase] = useState("");
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Hydrate inputs from any previously-saved credentials.
  useEffect(() => {
    setBase(getBaseUrl() ?? "");
    setToken(getToken() ?? "");
    setMode(getMode());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as "local" | "cloud";
      setMode(detail);
    };
    window.addEventListener("verdant:modeChanged", onChange);
    return () => window.removeEventListener("verdant:modeChanged", onChange);
  }, []);

  async function testConnection() {
    const normalized = base.replace(/\/+$/, "");
    if (!normalized || !token) {
      setStatus({ kind: "error", msg: "Base URL and token are required." });
      return;
    }
    setStatus({ kind: "busy", msg: "Pinging /auth/verify…" });
    try {
      const res = await fetch(`${normalized}/auth/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatus({ kind: "ok", msg: "Token accepted." });
      } else if (res.status === 401) {
        setStatus({ kind: "error", msg: "Server rejected the token (401)." });
      } else {
        setStatus({ kind: "error", msg: `Unexpected response: ${res.status}` });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        msg: `Network error: ${(err as Error).message}`,
      });
    }
  }

  async function saveAndEnable() {
    const normalized = base.replace(/\/+$/, "");
    if (!normalized || !token) return;
    setStatus({ kind: "busy", msg: "Saving credentials…" });
    saveOwnerCredentials(normalized, token);
    // Verify once more to avoid persisting a bad token.
    try {
      const res = await fetch(`${normalized}/auth/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus({ kind: "error", msg: `Verify failed (${res.status}).` });
        return;
      }
      enableCloudMode();
      setStatus({
        kind: "ok",
        msg: "Cloud Mode enabled. Pulling server snapshot…",
      });
      await pullFromServer();
      setStatus({ kind: "ok", msg: "Cloud Mode active. Server data loaded." });
      setMode("cloud");
    } catch (err) {
      setStatus({
        kind: "error",
        msg: `Failed: ${(err as Error).message}`,
      });
    }
  }

  async function migrateLocalToCloud() {
    if (
      !confirm(
        "This OVERWRITES the server with your current local data " +
          "(wipe=1). Continue?"
      )
    )
      return;
    setStatus({ kind: "busy", msg: "Uploading local snapshot…" });
    try {
      const counts = await pushAllToServer();
      setStatus({
        kind: "ok",
        msg: `Uploaded ${counts.plants} plants / ${counts.records} records / ${counts.photos} photos.`,
      });
    } catch (err) {
      setStatus({ kind: "error", msg: (err as Error).message });
    }
  }

  async function syncNow() {
    setStatus({ kind: "busy", msg: "Flushing pending sync…" });
    try {
      await flushSync();
      setStatus({ kind: "ok", msg: "Sync complete." });
    } catch (err) {
      setStatus({ kind: "error", msg: (err as Error).message });
    }
  }

  async function disable() {
    if (!confirm("Disable Cloud Mode? Local data is kept.")) return;
    clearOwnerCredentials();
    setMode("local");
    setStatus({ kind: "ok", msg: "Cloud Mode disabled." });
  }

  async function recheck() {
    setStatus({ kind: "busy", msg: "Re-checking…" });
    const m = await detectMode();
    setMode(m);
    setStatus({ kind: "ok", msg: `Mode is now: ${m}` });
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8 font-mono text-sm">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xs underline opacity-60">
          ← back
        </Link>
        <span
          className={
            "rounded-full px-2 py-0.5 text-xs " +
            (mode === "cloud"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-stone-200 text-stone-700")
          }
        >
          {mode === "cloud" ? "Cloud Mode" : "Local Mode"}
        </span>
      </div>

      <h1 className="mb-1 text-lg font-semibold">Owner setup</h1>
      <p className="mb-6 text-xs opacity-60">
        Single-owner Cloud Mode. Demo visitors aren&apos;t affected.
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs opacity-70">API base URL</span>
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="https://<host>.ts.net:8443"
          autoComplete="off"
          className="w-full rounded border border-stone-300 px-2 py-1.5"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-xs opacity-70">Owner token</span>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          autoComplete="off"
          className="w-full rounded border border-stone-300 px-2 py-1.5"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={testConnection}
          className="rounded border border-stone-300 px-3 py-1.5 text-xs"
        >
          Test connection
        </button>
        <button
          onClick={saveAndEnable}
          className="rounded bg-stone-900 px-3 py-1.5 text-xs text-white"
        >
          Save &amp; enable
        </button>

        <button
          onClick={migrateLocalToCloud}
          disabled={!isCloudMode()}
          className="rounded border border-stone-300 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Push local → cloud
        </button>
        <button
          onClick={syncNow}
          disabled={!isCloudMode()}
          className="rounded border border-stone-300 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Sync now
        </button>

        <button
          onClick={recheck}
          className="rounded border border-stone-300 px-3 py-1.5 text-xs"
        >
          Re-check /health
        </button>
        <button
          onClick={disable}
          className="rounded border border-rose-300 px-3 py-1.5 text-xs text-rose-700"
        >
          Disable Cloud
        </button>
      </div>

      {status.kind !== "idle" && (
        <div
          className={
            "mt-5 rounded border px-3 py-2 text-xs " +
            (status.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : status.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-stone-200 bg-stone-50 text-stone-700")
          }
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}
