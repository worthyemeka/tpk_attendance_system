"use client";

import { useEffect, useState } from "react";
import { FiExternalLink, FiPlay } from "react-icons/fi";
import { youtubeVideoId } from "@/lib/youtube-video";
import "./youtube-video-card.css";

type Metadata = { title: string; channel: string; duration: string | null; thumbnail: string };

export function YouTubeVideoCard({ url, label = "Video" }: { url: string; label?: string }) {
  const id = youtubeVideoId(url);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  useEffect(() => {
    setMetadata(null);
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/youtube-video?id=${id}`, { signal: controller.signal })
      .then(async response => response.ok ? await response.json() : null)
      .then(value => { if (!controller.signal.aborted) setMetadata(value); })
      .catch(() => {});
    return () => controller.abort();
  }, [id]);
  if (!id) return <a className="youtube-video-fallback" href={url} target="_blank" rel="noopener noreferrer"><FiPlay /> Watch video <FiExternalLink /></a>;
  return <div className="youtube-video-card">
    <div className="youtube-video-card__thumb">
      <img src={metadata?.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
      <span className="youtube-video-card__play" aria-hidden="true"><FiPlay /></span>
      {metadata?.duration && <span className="youtube-video-card__duration">{metadata.duration}</span>}
    </div>
    <div className="youtube-video-card__body">
      <small>{label}</small>
      <h4>{metadata?.title || "YouTube video"}</h4>
      <p>{metadata?.channel || "YouTube"} <span aria-hidden="true">·</span> {metadata?.duration || "Duration unavailable"}</p>
      <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">Watch video <FiExternalLink /></a>
    </div>
  </div>;
}
