"use client";

/**
 * useDataStore — lightweight client-side data hooks.
 *
 * All reads go through dataStore (never direct localStorage/IndexedDB).
 * Each hook manages its own loading + error state.
 * Refresh by calling the returned `reload` function.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getAllPlants,
  getPlantById,
  getRecordsByPlant,
  getPhoto,
  getPhotosByPlant,
  getPhotoNearDate,
  type Plant,
  type TimelineEntry,
  type Photo,
} from "@/lib/dataStore";

// ─── usePlants ────────────────────────────────────────────────────────────────

// Re-usable hook: runs `load` on mount AND whenever seed completes.
function useAutoReload(load: () => void) {
  useEffect(() => {
    load();
    window.addEventListener("verdant:seeded", load);
    return () => window.removeEventListener("verdant:seeded", load);
  }, [load]);
}

export function usePlants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPlants();
      setPlants(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useAutoReload(load);

  return { plants, loading, reload: load };
}

// ─── usePlant ─────────────────────────────────────────────────────────────────

export function usePlant(id: string) {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlantById(id);
      setPlant(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useAutoReload(load);

  return { plant, loading, reload: load };
}

// ─── useTimeline ──────────────────────────────────────────────────────────────

export function useTimeline(plantId: string) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!plantId) return;
    setLoading(true);
    try {
      const data = await getRecordsByPlant(plantId);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [plantId]);

  useAutoReload(load);

  return { entries, loading, reload: load };
}

// ─── usePhoto ─────────────────────────────────────────────────────────────────

export function usePhoto(photoId: string | undefined | null) {
  const [photo, setPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (!photoId) { setPhoto(null); return; }
    getPhoto(photoId).then(setPhoto);
  }, [photoId]);

  return photo;
}

// ─── usePhotosByPlant ─────────────────────────────────────────────────────────

export function usePhotosByPlant(plantId: string) {
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    if (!plantId) return;
    getPhotosByPlant(plantId).then(setPhotos);
  }, [plantId]);

  return photos;
}

// ─── useComparePhotoIds ───────────────────────────────────────────────────────
// Given a plantId and a "daysAgo" preset, returns the two photoIds for comparison.
// left = most recent photo; right = photo closest to daysAgo

type ComparePreset = "7d" | "30d" | "first";

export function useComparePhotoIds(plantId: string, preset: ComparePreset) {
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;

    async function resolve() {
      const photos = await getPhotosByPlant(plantId); // newest-first
      if (photos.length === 0) { setLeftId(null); setRightId(null); return; }

      // left = most recent
      const left = photos[0];
      setLeftId(left.id);

      // right = photo near the target date
      let targetDate: Date;
      if (preset === "first") {
        // oldest photo
        targetDate = new Date(photos[photos.length - 1].timestamp);
      } else {
        const days = preset === "7d" ? 7 : 30;
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);
      }

      const right = await getPhotoNearDate(plantId, targetDate);
      // If right is the same photo as left (plant is very new), set to null
      setRightId(right && right.id !== left.id ? right.id : null);
    }

    resolve();
  }, [plantId, preset]);

  return { leftId, rightId };
}
