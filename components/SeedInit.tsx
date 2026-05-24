"use client";

import { useEffect } from "react";
import { seedIfEmpty } from "@/lib/seedData";

/**
 * Client-side guard that seeds mock data on first mount.
 * Renders nothing. Safe to mount in any layout — seedIfEmpty is a no-op
 * if data already exists in localStorage.
 */
export default function SeedInit() {
  useEffect(() => {
    // Ask the browser to keep our data "persistent" so it's far less likely
    // to be evicted under storage pressure. Best-effort; ignored if denied.
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    seedIfEmpty().catch((err) => {
      console.error("[verdant] seed failed:", err);
    });
  }, []);

  return null;
}
