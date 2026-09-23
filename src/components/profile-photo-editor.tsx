"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
};

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumSize = 5 * 1024 * 1024;

export function ProfilePhotoEditor({ value, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(value);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [value]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) return;

    if (!acceptedTypes.includes(nextFile.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (nextFile.size > maximumSize) {
      setError("Please choose an image smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    onChange(nextFile);
  }

  async function applyCrop() {
    if (!value || !previewUrl) return;

    const image = new Image();
    image.src = previewUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("We could not prepare this image."));
    });

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const horizontalSpace = image.naturalWidth - sourceSize;
    const verticalSpace = image.naturalHeight - sourceSize;
    const sourceX = Math.max(0, Math.min(horizontalSpace, horizontalSpace / 2 + (horizontal / 100) * (horizontalSpace / 2)));
    const sourceY = Math.max(0, Math.min(verticalSpace, verticalSpace / 2 + (vertical / 100) * (verticalSpace / 2)));
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
    const cropped = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!cropped) return;

    const filename = `${value.name.replace(/\.[^.]+$/, "") || "profile-photo"}-cropped.jpg`;
    onChange(new File([cropped], filename, { type: "image/jpeg" }));
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    setError("");
  }

  function removePhoto() {
    onChange(null);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  return <section className="profile-photo-editor" aria-labelledby="profile-photo-label">
    <div className="profile-photo-editor-heading">
      <div>
        <span id="profile-photo-label">Profile photo</span>
        <small>Optional · JPEG, PNG, or WebP · up to 5 MB</small>
      </div>
      {previewUrl && <button type="button" className="profile-photo-remove" onClick={removePhoto}>Remove</button>}
    </div>
    <div className="profile-photo-editor-content">
      <div className="profile-photo-preview" aria-label={value ? "Profile photo preview" : "Empty profile photo preview"}>
        {previewUrl ? <img src={previewUrl} alt="Your selected profile photo" style={{ transform: `scale(${zoom}) translate(${horizontal / 2}%, ${vertical / 2}%)` }} /> : <span>TPK</span>}
      </div>
      <div className="profile-photo-controls">
        <input ref={fileInput} className="profile-photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
        <button type="button" className="profile-photo-choose" onClick={() => fileInput.current?.click()}>{value ? "Replace photo" : "Choose photo"}</button>
        {previewUrl && <div className="profile-photo-adjustments">
          <label>Zoom<input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <label>Move left / right<input type="range" min="-100" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} /></label>
          <label>Move up / down<input type="range" min="-100" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} /></label>
          <button type="button" className="profile-photo-apply" onClick={() => void applyCrop()}>Apply crop</button>
        </div>}
      </div>
    </div>
    {error && <p className="profile-photo-error" role="alert">{error}</p>}
  </section>;
}
