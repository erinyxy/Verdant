"use client";

/**
 * PhotoFromStore — renders a photo stored in IndexedDB as an <img> tag.
 *
 * Architecture note (CLAUDE.md): Always use <img src={dataUrl}>,
 * never CSS background-image — required for canvas/screenshot compatibility.
 *
 * Props:
 *   photoId    — the photo's id in IndexedDB
 *   alt        — accessible alt text
 *   className  — tailwind / class string passed to the <img>
 *   style      — inline styles
 *   fallback   — what to render while loading or if photo not found
 *               (defaults to a soft green placeholder div)
 */

import { usePhoto } from "@/hooks/useDataStore";

interface Props {
  photoId: string | null | undefined;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
  objectFit?: "cover" | "contain" | "fill";
}

export default function PhotoFromStore({
  photoId,
  alt = "",
  className = "",
  style,
  fallback,
  objectFit = "cover",
}: Props) {
  const photo = usePhoto(photoId);

  const defaultFallback = (
    <div
      className={className}
      style={{ background: "#e8f0e8", ...style }}
      aria-hidden="true"
    />
  );

  if (!photoId || !photo) {
    return fallback ?? defaultFallback;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.dataUrl}
      alt={alt}
      className={className}
      style={{ objectFit, ...style }}
    />
  );
}
