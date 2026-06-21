"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { ImageMinus, ImagePlus, RotateCw } from "lucide-react";
import { Button } from "../../Button.jsx";
import {
  ACCEPTED_INPUT_MIMES,
  avatarSourceRejectionMessage,
  MAX_AVATAR_SOURCE_BYTES,
} from "../../../lib/profile/avatarUpload.js";
import { blobToBase64Payload, getCroppedImageBlob } from "./cropImage.js";

/**
 * @param {{
 *   onCancel: () => void,
 *   onApply: (payload: { mime: string, data: string }) => Promise<void>,
 * }} props
 */
export function ImageCropStep({ onCancel, onApply }) {
  const [imageSrc, setImageSrc] = useState(/** @type {string | null} */ (null));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(
    /** @type {{ x: number, y: number, width: number, height: number } | null} */ (null),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const rejection = avatarSourceRejectionMessage(file);
    if (rejection) {
      setError(rejection);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCroppedAreaPixels(null);
      setImageSrc(typeof reader.result === "string" ? reader.result : null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    };
    reader.onerror = () => {
      setError("Could not read that image. Try another photo.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleReset() {
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setError("");
  }

  async function handleApply() {
    if (!imageSrc) return;
    if (!croppedAreaPixels) {
      setError("Preparing crop area… try again in a moment or adjust the image slightly.");
      return;
    }
    if (croppedAreaPixels.width < 64 || croppedAreaPixels.height < 64) {
      setError("Crop area is too small. Zoom out or choose a larger image.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, rotation);
      const payload = await blobToBase64Payload(blob);
      await onApply(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setPending(false);
    }
  }

  const canApply = Boolean(imageSrc && croppedAreaPixels && !pending);
  const maxMb = Math.round(MAX_AVATAR_SOURCE_BYTES / (1024 * 1024));

  if (!imageSrc) {
    return (
      <div className="px-5 py-6 sm:px-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border-2 border-dashed border-muted-bright/50 bg-muted-bright/10 px-6 py-12 text-center transition-colors hover:border-primary/40 hover:bg-muted-bright/20">
          <span className="text-4xl" aria-hidden>
            📷
          </span>
          <span className="text-sm font-bold text-foreground">Tap to choose a photo</span>
          <span className="text-xs text-foreground/55">
            PNG, JPEG, WebP, or HEIC up to {maxMb} MB
          </span>
          <input
            type="file"
            accept={[...ACCEPTED_INPUT_MIMES, "image/*"].join(",")}
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
        {error ? <p className="mt-3 text-sm font-bold text-error">{error}</p> : null}
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="relative h-72 overflow-hidden rounded-[var(--radius-xl)] bg-foreground/90 sm:h-80">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ImageMinus className="h-4 w-4 shrink-0 text-foreground/50" aria-hidden />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
          aria-label="Zoom"
        />
        <ImagePlus className="h-4 w-4 shrink-0 text-foreground/50" aria-hidden />
        <button
          type="button"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="shrink-0 rounded-[var(--radius-lg)] p-2 text-foreground/60 transition-colors hover:bg-muted-bright/30 hover:text-foreground"
          aria-label="Rotate 90 degrees"
        >
          <RotateCw className="h-5 w-5" />
        </button>
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-error">{error}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm font-bold text-foreground/60 transition-colors hover:text-foreground"
        >
          Reset
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleApply()} disabled={!canApply}>
            {pending ? "Applying…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
