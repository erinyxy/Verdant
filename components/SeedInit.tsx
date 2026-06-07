"use client";

import { useEffect } from "react";
import { seedIfEmpty } from "@/lib/seedData";
import { detectMode } from "@/lib/storeMode";
import { pullFromServer } from "@/lib/cloudSync";

/**
 * Client-side guard that seeds mock data on first mount, and — for the owner
 * in Cloud Mode — hydrates from the server before the rest of the app reads.
 *
 * Renders nothing. Safe to mount in any layout — every step is idempotent.
 */
export default function SeedInit() {
  useEffect(() => {
    // Ask the browser to keep our data "persistent" so it's far less likely
    // to be evicted under storage pressure. Best-effort; ignored if denied.
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    (async () => {
      // 1. Decide mode. detectMode pings /health if the owner opted in;
      //    falls back to "local" silently for anonymous visitors.
      const mode = await detectMode();

      if (mode === "cloud") {
        // 2a. Owner: pull server snapshot into local stores so the rest of
        //     the app reads consistent data. Errors here are non-fatal —
        //     stale local data is still usable.
        try {
          await pullFromServer();
        } catch (err) {
          console.warn("[verdant] cloud pull failed, using local cache:", err);
        }
        // Skip seedIfEmpty in Cloud Mode: this is the owner's real data,
        // never seed demo plants over it.
      } else {
        // 2b. Anonymous visitor: seed sample data if the store is empty.
        await seedIfEmpty().catch((err) => {
          console.error("[verdant] seed failed:", err);
        });
      }
    })();
  }, []);

  return null;
}
