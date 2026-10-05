"use client";

import { useEffect, useRef, useState } from 'react';
import { FiScissors, FiX } from 'react-icons/fi';
import { clipValidation, MAX_CLIP_SECONDS, trimVideo, VIDEO_SOURCE_BYTES } from '@/lib/video-trim';
import './video-trimmer.css';

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function VideoTrimmer({ file, budget, onUse, onClose }: {
  file: File; budget: number; onUse: (result: File) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const request = useRef<AbortController | null>(null);
  const [source, setSource] = useState('');
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const invalid = clipValidation(start, end, duration, budget);
  const close = () => { request.current?.abort(); onClose(); };
  useEffect(() => {
    const url = URL.createObjectURL(file); setSource(url);
    return () => { URL.revokeObjectURL(url); request.current?.abort(); };
  }, [file]);
  useEffect(() => {
    if (!result) { setResultUrl(''); return; }
    const url = URL.createObjectURL(result); setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  const change = (which: 'start' | 'end', value: number) => {
    if (!Number.isFinite(value)) return;
    video.current?.pause(); setPreviewing(false); setResult(null); setError('');
    if (which === 'start') { setStart(value); if (video.current) video.current.currentTime = value; }
    else setEnd(value);
  };
  const prepare = async () => {
    if (busy || invalid) return;
    const controller = new AbortController(); request.current = controller;
    video.current?.pause(); setPreviewing(false); setBusy(true); setError(''); setResult(null);
    try {
      const clip = await trimVideo(file, start, end, duration, budget, controller.signal, setProgress);
      if (!controller.signal.aborted) { setResult(clip); setProgress('Your clip is ready. Preview it before attaching.'); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'We couldn’t prepare this clip. Try again.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className="video-trimmer-backdrop" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Tab') {
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),video[controls],[tabindex="0"]') || []);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="video-trimmer-title" aria-busy={busy} className="video-trimmer">
      <header><div><p className="eyebrow">Assembly attachment</p><h2 id="video-trimmer-title"><FiScissors />Trim video</h2></div><button type="button" onClick={close} aria-label="Close video trimmer"><FiX /></button></header>
      <p className="video-trimmer-help">Choose the part you want to share. Your original stays untouched; only the clip you accept will be uploaded.</p>
      <p className="video-trimmer-file">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
      {source && <video ref={video} src={source} controls playsInline preload="metadata" onLoadedMetadata={(event) => {
        const seconds = event.currentTarget.duration;
        if (!Number.isFinite(seconds) || seconds <= 0) { setError('This video’s duration could not be read. Try an MP4 video.'); return; }
        setDuration(seconds); setEnd(Math.min(seconds, 60));
      }} onError={() => setError('This browser cannot preview this video. Try an MP4 copy from your phone’s editor.')} onTimeUpdate={(event) => {
        if (previewing && event.currentTarget.currentTime >= end) { event.currentTarget.pause(); setPreviewing(false); }
      }} />}
      <div className="video-trimmer-range">
        <label>Start · {clock(start)}<input aria-label="Clip start seconds" type="number" min={0} max={duration} step="0.1" value={start} disabled={busy || !duration} onChange={(e) => change('start', Number(e.target.value))} /><input aria-label="Clip start slider" type="range" min={0} max={duration || 1} step="0.1" value={start} disabled={busy || !duration} onChange={(e) => change('start', Number(e.target.value))} /></label>
        <label>End · {clock(end)}<input aria-label="Clip end seconds" type="number" min={0} max={duration} step="0.1" value={end} disabled={busy || !duration} onChange={(e) => change('end', Number(e.target.value))} /><input aria-label="Clip end slider" type="range" min={0} max={duration || 1} step="0.1" value={end} disabled={busy || !duration} onChange={(e) => change('end', Number(e.target.value))} /></label>
      </div>
      <div className="video-trimmer-selection"><span>{clock(Math.max(0, end - start))} selected · {(budget / 1024 / 1024).toFixed(1)} MB available</span><button type="button" disabled={busy || Boolean(invalid)} onClick={() => {
        if (!video.current) return;
        video.current.currentTime = start; setPreviewing(true);
        void video.current.play().catch(() => { setPreviewing(false); setError('Tap the video’s play button to preview your selection.'); });
      }}>Preview selection</button></div>
      <small>Up to {MAX_CLIP_SECONDS / 60} minutes per clip. Keep this page open while preparing. Larger sources may take longer on phones.</small>
      {file.size > VIDEO_SOURCE_BYTES && <p role="alert" className="video-trimmer-error">This source is over 100 MB. Shorten it in your phone’s editor first.</p>}
      {duration > 0 && invalid && <p className="video-trimmer-error">{invalid}</p>}
      {progress && <p role="status" aria-live="polite" className="video-trimmer-progress">{progress}</p>}
      {error && <p role="alert" className="video-trimmer-error">{error}</p>}
      {result && <div className="video-trimmer-result"><b>Trimmed clip · {(result.size / 1024 / 1024).toFixed(1)} MB</b>{resultUrl && <video src={resultUrl} controls playsInline preload="metadata" />}<small>Only this version will replace the selected attachment.</small></div>}
      <footer><button type="button" onClick={close}>{busy ? 'Cancel trimming' : 'Cancel'}</button>{result ? <button className="primary" type="button" onClick={() => onUse(result)}>Use trimmed video</button> : <button className="primary" type="button" disabled={busy || Boolean(invalid) || file.size > VIDEO_SOURCE_BYTES} onClick={() => void prepare()}>{busy ? 'Preparing clip…' : 'Prepare clip'}</button>}</footer>
    </section>
  </div>;
}
