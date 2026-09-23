"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FiCamera, FiMove, FiTrash2, FiUser, FiX, FiZoomIn } from "react-icons/fi";

type Props = { value: File | null; onChange: (file: File | null) => void };
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumSize = 5 * 1024 * 1024;

export function ProfilePhotoEditor({ value, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<File | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [zoom, setZoom] = useState(1); const [horizontal, setHorizontal] = useState(0); const [vertical, setVertical] = useState(0); const [error, setError] = useState("");

  useEffect(() => { if (!value) { setPreviewUrl(null); return; } const url = URL.createObjectURL(value); setPreviewUrl(url); return () => URL.revokeObjectURL(url); }, [value]);
  useEffect(() => { if (!draft) { setDraftUrl(null); return; } const url = URL.createObjectURL(draft); setDraftUrl(url); return () => URL.revokeObjectURL(url); }, [draft]);

  function resetDraft() { setDraft(null); setCropOpen(false); setZoom(1); setHorizontal(0); setVertical(0); if (fileInput.current) fileInput.current.value = ""; }
  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!acceptedTypes.includes(file.type)) { setError("Please choose a JPEG, PNG, or WebP image."); resetDraft(); return; }
    if (file.size > maximumSize) { setError("Please choose an image smaller than 5 MB."); resetDraft(); return; }
    setError(""); setDraft(file); setZoom(1); setHorizontal(0); setVertical(0); setCropOpen(true);
  }
  async function applyCrop() {
    if (!draft || !draftUrl) return;
    const image = new Image(); image.src = draftUrl;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("We could not prepare this image.")); });
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const spaceX = image.naturalWidth - sourceSize; const spaceY = image.naturalHeight - sourceSize;
    const x = Math.max(0, Math.min(spaceX, spaceX / 2 + (horizontal / 100) * (spaceX / 2)));
    const y = Math.max(0, Math.min(spaceY, spaceY / 2 + (vertical / 100) * (spaceY / 2)));
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 640; const context = canvas.getContext("2d"); if (!context) return;
    context.drawImage(image, x, y, sourceSize, sourceSize, 0, 0, 640, 640);
    const cropped = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92)); if (!cropped) return;
    onChange(new File([cropped], `${draft.name.replace(/\.[^.]+$/, "") || "profile-photo"}.jpg`, { type: "image/jpeg" })); resetDraft();
  }
  function removePhoto() { onChange(null); resetDraft(); setError(""); }

  return <section className="avatar-picker" aria-labelledby="profile-photo-label">
    <input ref={fileInput} className="avatar-picker-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
    <button type="button" className="avatar-picker-circle" onClick={() => fileInput.current?.click()} aria-label={previewUrl ? "Change profile photo" : "Choose profile photo"}>{previewUrl ? <img src={previewUrl} alt="Selected profile photo" /> : <><FiUser /><span><FiCamera /></span></>}</button>
    <div className="avatar-picker-copy"><b id="profile-photo-label">Profile photo</b><small>Optional · JPEG, PNG, or WebP · up to 5 MB</small><div>{previewUrl ? <><button type="button" className="avatar-text-button" onClick={() => fileInput.current?.click()}>Change photo</button><button type="button" className="avatar-text-button danger" onClick={removePhoto}>Remove</button></> : <button type="button" className="avatar-upload-button" onClick={() => fileInput.current?.click()}><FiCamera />Upload photo</button>}</div></div>
    {error && <p className="avatar-picker-error" role="alert">{error}</p>}
    {cropOpen && draftUrl && <div className="avatar-crop-overlay" role="dialog" aria-modal="true" aria-label="Crop profile photo"><section className="avatar-crop-modal"><button className="avatar-crop-close" type="button" onClick={resetDraft} aria-label="Close photo crop"><FiX /></button><p className="eyebrow">Profile photo</p><h2>Position your photo</h2><p>Drag the controls until your face sits comfortably inside the circle.</p><div className="avatar-crop-frame"><img src={draftUrl} alt="Photo crop preview" style={{ transform: `scale(${zoom}) translate(${horizontal / 2}%, ${vertical / 2}%)` }} /></div><div className="avatar-crop-controls"><label><span><FiZoomIn />Zoom</span><input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label><span><FiMove />Move left / right</span><input type="range" min="-100" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} /></label><label><span><FiMove />Move up / down</span><input type="range" min="-100" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} /></label></div><div className="avatar-crop-actions"><button type="button" className="avatar-cancel" onClick={resetDraft}>Cancel</button><button type="button" className="avatar-save" onClick={() => void applyCrop()}>Use photo</button></div></section></div>}
    <style jsx>{`
      .avatar-picker{display:grid;grid-template-columns:92px 1fr;align-items:center;gap:14px;padding:16px;border:1px solid #dfe5ef;border-radius:13px;background:#fbfcff}.avatar-picker-file{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.avatar-picker-circle{position:relative;display:grid;place-items:center;width:92px;height:92px;overflow:hidden;border:3px solid #fff;border-radius:50%;background:#eef5f1;box-shadow:0 0 0 1px #cfd9e8;color:#16835f;cursor:pointer}.avatar-picker-circle>svg{font-size:35px}.avatar-picker-circle span{position:absolute;right:1px;bottom:1px;display:grid;place-items:center;width:28px;height:28px;border:2px solid #fff;border-radius:50%;background:#f05531;color:#fff}.avatar-picker-circle span svg{font-size:14px}.avatar-picker-circle img{width:100%;height:100%;object-fit:cover}.avatar-picker-copy{display:grid;gap:4px}.avatar-picker-copy b{color:#13254a;font-size:12px}.avatar-picker-copy small{color:#687184;font-size:10px;font-weight:600}.avatar-picker-copy div{display:flex;gap:10px;margin-top:5px}.avatar-upload-button,.avatar-text-button{display:inline-flex;align-items:center;gap:6px;width:max-content;border:0;background:transparent;color:#e54829;font:800 11px var(--font-body);cursor:pointer}.avatar-upload-button{height:32px;padding:0 11px;border:1px solid #e95b39;border-radius:7px;background:#fff}.avatar-text-button.danger{color:#bd3d28}.avatar-picker-error{grid-column:1/-1;margin:0;color:#c53d24;font-size:10px;font-weight:700}.avatar-crop-overlay{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:20px;background:rgba(9,25,54,.58);backdrop-filter:blur(3px)}.avatar-crop-modal{position:relative;width:min(100%,510px);max-height:calc(100vh - 40px);overflow:auto;padding:30px;background:#fffdfa;border-radius:16px;box-shadow:0 24px 70px #07122655}.avatar-crop-modal h2{margin:4px 0 6px;font:400 31px/1.05 var(--font-display),Georgia,serif;color:#10213d}.avatar-crop-modal>p:not(.eyebrow){margin:0 0 18px;color:#687184;font-size:12px;line-height:1.5}.avatar-crop-close{position:absolute;right:14px;top:14px;display:grid;place-items:center;width:33px;height:33px;border:0;border-radius:50%;background:#f4f1eb;color:#4c5361;cursor:pointer}.avatar-crop-frame{width:min(270px,72vw);height:min(270px,72vw);margin:0 auto 21px;overflow:hidden;border:5px solid #fff;border-radius:50%;background:#e8edf0;box-shadow:0 0 0 1px #cfd9e8}.avatar-crop-frame img{width:100%;height:100%;object-fit:cover;transform-origin:center}.avatar-crop-controls{display:grid;gap:13px}.avatar-crop-controls label{display:grid;gap:7px}.avatar-crop-controls span{display:flex;align-items:center;gap:7px;color:#52617a;font-size:11px;font-weight:800}.avatar-crop-controls span svg{color:#e85230}.avatar-crop-controls input{width:100%;accent-color:#ed5733}.avatar-crop-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.avatar-cancel,.avatar-save{height:39px;border-radius:8px;padding:0 14px;font:800 11px var(--font-body);cursor:pointer}.avatar-cancel{border:1px solid #d9dfe8;background:#fff;color:#566b91}.avatar-save{border:0;background:#f05531;color:#fff}@media(max-width:560px){.avatar-picker{grid-template-columns:76px 1fr}.avatar-picker-circle{width:76px;height:76px}.avatar-picker-copy div{display:grid;justify-content:start}.avatar-crop-modal{padding:26px 20px}.avatar-crop-frame{width:min(245px,72vw);height:min(245px,72vw)}}
    `}</style>
  </section>;
}
