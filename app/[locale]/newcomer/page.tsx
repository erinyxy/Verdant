"use client";

/**
 * Newcomer page — /[locale]/newcomer
 * Add a new plant: photo upload, name (required), nickname, started-on date.
 * Saves to dataStore then navigates to the new plant's detail page.
 */

import { useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { savePlant, savePhoto, saveRecord } from "@/lib/dataStore";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function compressAndConvert(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
  });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(compressed);
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewcomerPage() {
  const t = useTranslations("newcomer");
  const locale = useLocale();
  const router = useRouter();

  // Form state — startedOn defaults to today so users don't accidentally leave
  // it empty (which would make the day-1 photo land "now" instead of when they
  // first met the plant). They can still pick a past date.
  const todayStr = new Date().toISOString().slice(0, 10);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [startedOn, setStartedOn] = useState(todayStr);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Photo selection ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAndConvert(file);
      setPhotoDataUrl(dataUrl);
    } catch (err) {
      console.error("Image compression failed", err);
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    // Validate required field
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSaving(true);

    try {
      // The day-1 anchor. startedOn always has a value because the form
      // defaults to today; falling back to today again here is defensive.
      const startDate = startedOn || todayStr;
      // Use local noon to match how the rest of the app constructs day-only
      // timestamps (mirrors dateStrToTimestamp on the plant detail page);
      // avoids the timezone surprise where `new Date(YYYY-MM-DD)` lands at
      // 00:00 UTC and becomes the previous day in JST/CST locales.
      const startTimestamp = new Date(`${startDate}T12:00:00`).toISOString();

      // 1. Create plant (no coverPhotoId yet).
      const plant = await savePlant({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        startedOn: startDate,
      });

      // 2. If a photo was uploaded: stamp it at startedOn (not "now"), then
      //    attach it to an auto-generated bringHome record on the same day.
      //    This matches seedData's day-1 pattern: photo as a regular (not
      //    isCover) timeline photo, attached to a record so the timeline
      //    has a real entry at day 1.
      let dayOnePhotoId: string | undefined;
      if (photoDataUrl) {
        const photo = await savePhoto({
          plantId: plant.id,
          timestamp: startTimestamp,
          dataUrl: photoDataUrl,
        });
        dayOnePhotoId = photo.id;
      }

      // 3. Auto-create the bringHome record at startedOn. Without a photo we
      //    still create the record — the timeline should reflect "I brought
      //    this home on <date>" regardless.
      await saveRecord({
        plantId: plant.id,
        timestamp: startTimestamp,
        actions: ["bringHome"],
        states: [],
        photoIds: dayOnePhotoId ? [dayOnePhotoId] : [],
      });

      // 4. If we have a day-1 photo, also use it as the avatar (coverPhotoId
      //    fallback — handoff §7.1). Users can later swap the avatar via
      //    CoverPhotoPicker (which uses isCover=true so it doesn't disturb
      //    Growth Compare / Milestone queries).
      if (dayOnePhotoId) {
        await savePlant({
          id: plant.id,
          name: plant.name,
          nickname: plant.nickname,
          startedOn: plant.startedOn,
          coverPhotoId: dayOnePhotoId,
        });
      }

      // 5. Navigate to detail page.
      router.push(`/${locale}/plant/${plant.id}`);
    } catch (err) {
      console.error("Save failed", err);
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 pt-14 pb-28">
      <h1 className="text-xl mb-8" style={{ color: "#2c2c2c", fontFamily: "var(--font-manrope), sans-serif", fontWeight: 500 }}>
        {t("title")}
      </h1>

      {/* Photo upload area */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-52 rounded-2xl flex flex-col items-center justify-center mb-6 transition-opacity active:opacity-70 overflow-hidden relative"
        style={{ background: "#e8f0e8" }}
        aria-label={t("uploadPhoto")}
      >
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUrl}
            alt="Plant photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8fad8f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-2"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-sm" style={{ color: "#8fad8f" }}>
              + {t("uploadPhoto")}
            </span>
          </>
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Form fields */}
      <div className="space-y-4">
        {/* Plant name (required) */}
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: "#fdfaf6",
            boxShadow: nameError
              ? "0 0 0 1.5px #e08080"
              : "0 1px 8px rgba(0,0,0,0.04)",
          }}
        >
          <label className="block text-xs mb-1" style={{ color: "#b0aba5" }}>
            {t("plantName")} <span style={{ color: "#e08080" }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(false); }}
            placeholder={t("plantNamePlaceholder")}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: "#2c2c2c" }}
          />
          {nameError && (
            <p className="text-xs mt-1" style={{ color: "#e08080" }}>
              {t("nameRequired")}
            </p>
          )}
        </div>

        {/* Nickname (optional) */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
        >
          <label className="block text-xs mb-1" style={{ color: "#b0aba5" }}>
            {t("nickname")}
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t("nicknamePlaceholder")}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: "#2c2c2c" }}
          />
        </div>

        {/* Started on (optional date) */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
        >
          <label className="block text-xs mb-1" style={{ color: "#b0aba5" }}>
            {t("startedOn")}
          </label>
          <input
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            max={todayStr}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: startedOn ? "#2c2c2c" : "#b0aba5" }}
          />
          <p className="text-[11px] mt-1" style={{ color: "#b0aba5" }}>
            {t("startedOnHint")}
          </p>
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-8 py-3 rounded-2xl text-white font-medium transition-opacity active:opacity-80 disabled:opacity-50"
        style={{ background: "#8fad8f" }}
      >
        {saving ? "…" : t("save")}
      </button>
    </div>
  );
}
