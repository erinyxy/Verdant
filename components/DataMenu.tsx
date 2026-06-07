"use client";

/**
 * DataMenu — gear button in the My Garden header opening a small menu with
 * Export backup / Restore from backup. Browser storage is fragile, so this
 * gives the user a lossless, portable JSON they can keep anywhere.
 *
 * - Export: downloads verdant-backup-YYYY-MM-DD.json (all plants, records,
 *   marks, and photos as base64).
 * - Restore: pick a backup JSON → confirm (overwrite warning) → importBackup
 *   replaces everything → dispatch "verdant:seeded" so all hooks refetch.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { exportBackup, importBackup } from "@/lib/dataStore";

export default function DataMenu() {
  const t = useTranslations("backup");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Outside-click / Escape closes the menu.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleExport() {
    setOpen(false);
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdant-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleImportClick() {
    setOpen(false);
    setError(false);
    fileRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || data.app !== "verdant" || !Array.isArray(data.plants)) {
        setError(true);
        return;
      }
      setPendingImport(data); // open confirm dialog
    } catch {
      setError(true);
    }
  }

  async function confirmImport() {
    if (pendingImport === null) return;
    setBusy(true);
    try {
      await importBackup(pendingImport);
      window.dispatchEvent(new Event("verdant:seeded"));
      setPendingImport(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menuLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity active:opacity-60"
        style={{ color: "#9a948e" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-30 rounded-xl overflow-hidden"
          style={{
            background: "#fdfaf6",
            boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
            border: "1px solid rgba(0,0,0,0.05)",
            minWidth: 180,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleExport}
            className="block w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-black/[0.03]"
            style={{ color: "#3a3530" }}
          >
            {t("export")}
          </button>
          <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
          <button
            type="button"
            role="menuitem"
            onClick={handleImportClick}
            className="block w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-black/[0.03]"
            style={{ color: "#3a3530" }}
          >
            {t("import")}
          </button>
          <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push(`/${locale}/owner`);
            }}
            className="block w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-black/[0.03]"
            style={{ color: "#3a3530" }}
          >
            Cloud Mode…
          </button>
        </div>
      )}

      {/* Hidden file input for restore */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFileChosen}
        hidden
      />

      {/* Invalid-file note */}
      {error && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center px-8"
          style={{ background: "rgba(38,36,32,0.45)" }}
          onClick={() => setError(false)}
        >
          <div
            className="w-full rounded-2xl p-5 text-center"
            style={{ background: "#fdfaf6", maxWidth: 300, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#3a3530" }}>
              {t("invalidFile")}
            </p>
            <button
              type="button"
              onClick={() => setError(false)}
              className="text-sm px-4 py-2 rounded-full transition-opacity active:opacity-70"
              style={{ color: "#7a7570", background: "rgba(0,0,0,0.04)" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Restore confirmation (overwrite warning) */}
      {pendingImport !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center px-8"
          style={{ background: "rgba(38,36,32,0.45)" }}
          onClick={() => { if (!busy) setPendingImport(null); }}
        >
          <div
            className="w-full rounded-2xl p-5"
            style={{ background: "#fdfaf6", maxWidth: 300, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#3a3530" }}>
              {t("importConfirm")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                disabled={busy}
                className="text-sm px-4 py-2 rounded-full transition-opacity active:opacity-70"
                style={{ color: "#7a7570", background: "rgba(0,0,0,0.04)" }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={busy}
                className="text-sm px-4 py-2 rounded-full text-white transition-opacity active:opacity-70"
                style={{ background: "#77826e", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "…" : t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
