"use client";

/**
 * CoverPhotoPicker — full-screen modal for choosing a plant's cover photo.
 *
 * Design choice: `plant.coverPhotoId` is purely the avatar.
 * Growth Compare and Milestone marks already lookup the "first day" photo by
 * timestamp, so changing the avatar does NOT affect any "first day" semantics.
 *
 * UX:
 *   - Triggered by camera button on plant detail hero
 *   - Grid of all photos for the plant (newest-first), each tappable
 *   - Current cover gets a sage ring + checkmark
 *   - Tap any photo → savePlant + close (instant, no extra confirm)
 *   - Backdrop click / X button / Esc all close without changes
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePhotosByPlant } from "@/hooks/useDataStore";
import { savePlant, type Plant } from "@/lib/dataStore";
import PhotoFromStore from "@/components/PhotoFromStore";

interface Props {
  plant: Plant;
  onClose: () => void;
  /** Called after savePlant resolves so the parent can reload. */
  onPicked: () => void;
}

export default function CoverPhotoPicker({ plant, onClose, onPicked }: Props) {
  const t = useTranslations("plantDetail");
  const tMarks = useTranslations("marks"); // for the close label, already translated
  const photos = usePhotosByPlant(plant.id);

  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handlePick(photoId: string) {
    if (saving || photoId === plant.coverPhotoId) {
      // No-op if it's already the current cover
      if (photoId === plant.coverPhotoId) onClose();
      return;
    }
    setSaving(true);
    setPendingId(photoId);
    try {
      await savePlant({ ...plant, coverPhotoId: photoId });
      onPicked();
      onClose();
    } finally {
      setSaving(false);
      setPendingId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: "rgba(38, 36, 32, 0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 220ms ease-out",
      }}
      onClick={() => { if (!saving) onClose(); }}
    >
      {/* Sheet — clicking inside doesn't close */}
      <div
        className="mt-auto flex flex-col rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fdfaf6",
          maxHeight: "85%",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.10)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2
            className="text-base"
            style={{
              color: "#3a3530",
              fontFamily: "var(--font-manrope), sans-serif",
              fontWeight: 500,
            }}
          >
            {t("chooseCover")}
          </h2>
          <button
            type="button"
            onClick={() => { if (!saving) onClose(); }}
            aria-label={tMarks("close")}
            className="flex items-center justify-center rounded-full"
            style={{ width: 28, height: 28, color: "#7a7570", background: "rgba(0,0,0,0.04)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Photo grid (scrolls) */}
        <div className="px-5 pb-6 overflow-y-auto overscroll-contain">
          {photos.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "#9a948e" }}>
              {t("noPhotosYet")}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((photo) => {
                const isCurrent = photo.id === plant.coverPhotoId;
                const isPending = photo.id === pendingId;
                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(photo.id)}
                      disabled={saving}
                      aria-pressed={isCurrent}
                      className="relative block w-full aspect-square rounded-xl overflow-hidden transition-transform active:scale-[0.97]"
                      style={{
                        boxShadow: isCurrent
                          ? "0 0 0 2px #8fad8f, 0 1px 4px rgba(0,0,0,0.08)"
                          : "0 1px 4px rgba(0,0,0,0.06)",
                        opacity: saving && !isPending ? 0.5 : 1,
                      }}
                    >
                      <PhotoFromStore
                        photoId={photo.id}
                        alt=""
                        className="absolute inset-0 w-full h-full"
                        objectFit="cover"
                      />
                      {isCurrent && (
                        <span
                          className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full"
                          style={{
                            width: 20,
                            height: 20,
                            background: "#8fad8f",
                            color: "#fff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }}
                          aria-hidden="true"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
