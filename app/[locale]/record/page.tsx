"use client";

/**
 * Record page — /[locale]/record
 * Quick-record caring actions, plant states, photo, and note.
 *
 * URL param: ?plantId=xxx  → pre-selects that plant (from FAB on detail page)
 */

import { useState, useRef, useEffect, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import imageCompression from "browser-image-compression";
import { usePlants } from "@/hooks/useDataStore";
import { saveRecord, savePhoto, type ActionType, type StateType } from "@/lib/dataStore";
import PhotoFromStore from "@/components/PhotoFromStore";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD → ISO timestamp at local noon (avoids timezone date-shift). */
function dateStrToTimestamp(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

// ─── Chip button (for actions and states) ────────────────────────────────────

function ChipButton({
  selected,
  onClick,
  children,
  variant = "action",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "action" | "state";
}) {
  // Actions: green tint; States: warm sand tint — "same style, distinct feel" (PRD)
  const bgOn = variant === "action" ? "#8fad8f" : "#c9a97a";
  const bgOff = variant === "action" ? "#e8f0e8" : "#f2ece3";
  const colorOn = "#fff";
  const colorOff = variant === "action" ? "#5a8a5a" : "#8a6a3a";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm px-4 py-2 rounded-full transition-all active:opacity-80"
      style={{
        background: selected ? bgOn : bgOff,
        color: selected ? colorOn : colorOff,
        fontWeight: selected ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

// ─── Inner component (needs useSearchParams → must be inside Suspense) ────────

function RecordForm() {
  const t = useTranslations("record");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("plantId") ?? "";

  const { plants, loading: plantsLoading } = usePlants();

  // Form state
  const [selectedPlantId, setSelectedPlantId] = useState(preselectedId);
  const [recordDate, setRecordDate] = useState(todayStr());
  const [actions, setActions] = useState<Set<ActionType>>(new Set());
  const [states, setStates] = useState<Set<StateType>>(new Set());
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // When plants load and preselected id not in list, fallback to first plant
  useEffect(() => {
    if (!plantsLoading && plants.length > 0 && !selectedPlantId) {
      setSelectedPlantId(plants[0].id);
    }
  }, [plantsLoading, plants, selectedPlantId]);

  // ── Toggles ──────────────────────────────────────────────────────────────────

  function toggleAction(a: ActionType) {
    setActions((prev) => {
      const next = new Set(prev);
      next.has(a) ? next.delete(a) : next.add(a);
      return next;
    });
  }

  function toggleState(s: StateType) {
    setStates((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  // ── Photo ─────────────────────────────────────────────────────────────────────

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

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedPlantId) return;
    setSaving(true);
    try {
      // 1. Save photo if provided
      const timestamp = dateStrToTimestamp(recordDate);
      const photoIds: string[] = [];
      if (photoDataUrl) {
        const photo = await savePhoto({
          plantId: selectedPlantId,
          timestamp,
          dataUrl: photoDataUrl,
        });
        photoIds.push(photo.id);
      }

      // 2. Save record
      await saveRecord({
        plantId: selectedPlantId,
        timestamp,
        actions: Array.from(actions),
        states: Array.from(states),
        photoIds,
        note: note.trim() || undefined,
      });

      // 3. Show success feedback, then navigate to detail
      setSaved(true);
      setTimeout(() => {
        router.push(`/${locale}/plant/${selectedPlantId}`);
      }, 800);
    } catch (err) {
      console.error("Save failed", err);
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const selectedPlant = plants.find((p) => p.id === selectedPlantId);
  const canSave = !!selectedPlantId && (actions.size > 0 || states.size > 0 || !!photoDataUrl);

  return (
    <div className="px-5 pt-14 pb-28">
      <h1 className="text-xl mb-6" style={{ color: "#2c2c2c", fontFamily: "var(--font-manrope), sans-serif", fontWeight: 500 }}>
        {t("title")}
      </h1>

      {/* ── Plant selector ─────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
          {t("selectPlant")}
        </p>

        {plantsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-16 h-20 rounded-2xl animate-pulse"
                style={{ background: "#e8f0e8" }}
              />
            ))}
          </div>
        ) : plants.length === 0 ? (
          <p className="text-sm" style={{ color: "#b0aba5" }}>
            No plants yet — add one first!
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto py-1.5 px-0.5">
            {plants.map((plant) => {
              const isSelected = plant.id === selectedPlantId;
              return (
                <button
                  key={plant.id}
                  type="button"
                  onClick={() => setSelectedPlantId(plant.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 transition-all active:opacity-70"
                >
                  <div
                    className="w-14 h-14 rounded-2xl overflow-hidden"
                    style={{
                      outline: isSelected ? "2.5px solid #8fad8f" : "2.5px solid transparent",
                      outlineOffset: 2,
                    }}
                  >
                    <PhotoFromStore
                      photoId={plant.coverPhotoId}
                      alt={plant.name}
                      className="w-full h-full object-cover"
                      objectFit="cover"
                    />
                  </div>
                  <p
                    className="text-[10px] text-center max-w-[56px] truncate"
                    style={{ color: isSelected ? "#5a8a5a" : "#b0aba5", fontWeight: isSelected ? 600 : 400 }}
                  >
                    {plant.nickname || plant.name}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Date ────────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
          {t("date")}
        </p>
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
        >
          <input
            type="date"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            max={todayStr()}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: "#2c2c2c" }}
          />
        </div>
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
          {t("action")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["water", "fertilize", "repot", "prune", "bringHome", "sow"] as ActionType[]).map((a) => (
            <ChipButton
              key={a}
              selected={actions.has(a)}
              onClick={() => toggleAction(a)}
              variant="action"
            >
              {a === "water" && "💧 "}
              {a === "fertilize" && "🌱 "}
              {a === "repot" && "🪴 "}
              {a === "prune" && "✂️ "}
              {a === "bringHome" && "🏠 "}
              {a === "sow" && "🌾 "}
              {t(a)}
            </ChipButton>
          ))}
        </div>
      </section>

      {/* ── States ──────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
          {t("state")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["newLeaf", "blooming", "sick", "lookingBeautiful"] as StateType[]).map((s) => (
            <ChipButton
              key={s}
              selected={states.has(s)}
              onClick={() => toggleState(s)}
              variant="state"
            >
              {s === "newLeaf" && "🌿 "}
              {s === "blooming" && "🌸 "}
              {s === "sick" && "⚠️ "}
              {s === "lookingBeautiful" && "💚 "}
              {t(s)}
            </ChipButton>
          ))}
        </div>
      </section>

      {/* ── Photo ───────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
          {t("photo")}
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-40 rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-opacity active:opacity-70 relative"
          style={{ background: "#f0ebe3" }}
          aria-label={t("addPhoto")}
        >
          {photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoDataUrl} alt="Record photo" className="w-full h-full object-cover" />
          ) : (
            <>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c9a97a"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-2"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-sm" style={{ color: "#c9a97a" }}>
                + {t("addPhoto")}
              </span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </section>

      {/* ── Note ────────────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
          {t("note")}
        </p>
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            rows={3}
            className="w-full text-sm bg-transparent outline-none resize-none"
            style={{ color: "#2c2c2c" }}
          />
        </div>
      </section>

      {/* ── Save button ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saving || saved}
        className="w-full py-3 rounded-2xl text-white font-medium transition-all active:opacity-80 disabled:opacity-40"
        style={{ background: saved ? "#5a8a5a" : "#8fad8f" }}
      >
        {saved ? t("saved") : saving ? "…" : t("save")}
      </button>
    </div>
  );
}

// ─── Page wrapper (Suspense required for useSearchParams) ────────────────────

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="px-5 pt-14"><div className="animate-pulse h-8 w-40 rounded-lg" style={{ background: "#e8f0e8" }} /></div>}>
      <RecordForm />
    </Suspense>
  );
}
