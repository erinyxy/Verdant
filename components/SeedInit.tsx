"use client";

import { useEffect } from "react";
import { seedIfEmpty } from "@/lib/seedData";
import { detectMode } from "@/lib/storeMode";
// Importing cloudSync for its side effect: registers the "verdant:mutated"
// listener so writes in Cloud Mode auto-push to the server.
import "@/lib/cloudSync";

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
        // 2a. Owner in Cloud Mode: do NOT auto-pull. Local stays the
        //     working copy; mutations push to the server in the background
        //     (lib/cloudSync). Auto-pulling here would clobber any offline
        //     writes that hadn't synced yet. The owner can manually pull
        //     from /owner when they actually want server → local.
        // Skip seedIfEmpty in Cloud Mode: never seed demo plants over the
        // owner's real data.
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
