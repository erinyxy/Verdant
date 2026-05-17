"use client";

/**
 * PhotoCompare — side-by-side photo comparison component.
 *
 * Architecture (CLAUDE.md): Interface accepts explicit photoIds, NOT daysAgo.
 * The parent resolves "7 days ago" → photoId and passes it here.
 * This keeps the component reusable for any pair of photos (e.g. user-selected).
 *
 * Props:
 *   leftPhotoId   — most recent photo (right side of timeline)
 *   rightPhotoId  — older reference photo (left side of timeline)
 *   leftLabel     — label under left photo (e.g. "Today")
 *   rightLabel    — label under right photo (e.g. "7 days ago")
 *   summaryText   — descriptive sentence shown below the pair
 */

import PhotoFromStore from "./PhotoFromStore";

interface Props {
  leftPhotoId: string | null;
  rightPhotoId: string | null;
  leftLabel?: string;
  rightLabel?: string;
  summaryText?: string;
}

export default function PhotoCompare({
  leftPhotoId,
  rightPhotoId,
  leftLabel,
  rightLabel,
  summaryText,
}: Props) {
  return (
    <div>
      <div className="flex gap-3 mb-3">
        {/* Right photo = older reference */}
        <div className="flex-1 flex flex-col gap-1.5">
          <PhotoFromStore
            photoId={rightPhotoId}
            alt={rightLabel ?? ""}
            className="w-full aspect-square rounded-xl object-cover"
            objectFit="cover"
          />
          {rightLabel && (
            <p className="text-[10px] text-center tracking-wide" style={{ color: "#b0aba5" }}>
              {rightLabel}
            </p>
          )}
        </div>

        {/* Left photo = most recent */}
        <div className="flex-1 flex flex-col gap-1.5">
          <PhotoFromStore
            photoId={leftPhotoId}
            alt={leftLabel ?? ""}
            className="w-full aspect-square rounded-xl object-cover"
            objectFit="cover"
          />
          {leftLabel && (
            <p className="text-[10px] text-center tracking-wide" style={{ color: "#b0aba5" }}>
              {leftLabel}
            </p>
          )}
        </div>
      </div>

      {summaryText && (
        <p className="text-sm text-center" style={{ color: "#7a7570" }}>
          {summaryText}
        </p>
      )}
    </div>
  );
}
