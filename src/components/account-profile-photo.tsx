"use client";

import { useRef, useState } from "react";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { apiBase, authHeaders, mediaUrl, readTeacherSession, saveTeacherSession } from "@/lib/session";

type Props = { imageUrl?: string | null; onSaved: (url: string | null) => void };

export function AccountProfilePhoto({ imageUrl, onSaved }: Props) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function updatePhoto(file: File | null) {
    if (pending.current) return;
    setError("");
    setMessage("");
    const session = readTeacherSession();
    if (!session) { setError("Please sign in again before updating your photo."); return; }
    pending.current = true;
    setBusy(true);
    try {
      const data = new FormData();
      if (file) data.append("profilePhoto", file);
      const response = await fetch(`${apiBase}/api/v1/me/profile-photo`, {
        method: file ? "POST" : "DELETE",
        headers: authHeaders(session),
        ...(file ? { body: data } : {}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false || !result?.data ||
        (file && (typeof result.data.profileImageUrl !== "string" || !result.data.profileImageUrl))) {
        throw new Error(result?.error?.message || (file
          ? "We could not upload your photo. Please try again."
          : "We could not remove your photo. Please try again."));
      }
      const latestSession = readTeacherSession();
      if (latestSession?.staffUserId !== session.staffUserId || latestSession.sessionToken !== session.sessionToken) return;
      const url = file ? result.data.profileImageUrl as string : null;
      saveTeacherSession({ ...latestSession, profileImageUrl: url });
      onSaved(url);
      setMessage(file ? "Your new profile photo has been saved." : "Your profile photo has been removed. You can upload a new one anytime.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not update your photo. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <section className="account-photo" aria-label="Update your profile photo" aria-busy={busy}>
    <p className="photo-note">Shown to your team in the directory and roster. Photo changes save automatically.</p>
    <ProfilePhotoEditor value={null} imageUrl={mediaUrl(imageUrl)} disabled={busy} onChange={(file) => void updatePhoto(file)} />
    {busy && <p className="photo-status" role="status">Updating your photo…</p>}
    {error && <p className="photo-error" role="alert">{error}</p>}
    {message && <p className="photo-success" role="status">{message}</p>}
    <style jsx>{`
      .account-photo{padding-bottom:22px;border-bottom:1px solid var(--line)}
      .photo-note{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.5}
      .photo-status,.photo-error,.photo-success{margin:12px 0 0;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.5}
      .photo-status{background:#f3f6fa;color:#566b91}.photo-error{background:#fff1eb;color:#b33b23}.photo-success{background:#edf9f3;color:#087757}
    `}</style>
  </section>;
}
