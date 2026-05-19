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
    seedIfEmpty().catch((err) => {
      console.error("[verdant] seed failed:", err);
    });
  }, []);

  return null;
}
