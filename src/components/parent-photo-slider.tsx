"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const slides = [
  "slide-1.jpeg", "slide-2.jpeg", "slide-3.jpeg", "slide-4.jpeg", "slide-5.jpeg",
  "slide-6.jpeg", "slide-7.jpeg", "slide-8.jpeg", "slide-9.jpeg", "slide-10.jpeg", "slide-11.jpeg",
];

export function ParentPhotoSlider({ compact = false }: { compact?: boolean }) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside className={`parent-photo-slider ${compact ? "parent-photo-slider-compact" : ""}`} aria-label="Moments from TribePetra Kids">
      <Image
        alt=""
        className="parent-photo-slider-image"
        fill
        key={slides[slideIndex]}
        priority={slideIndex === 0}
        sizes="(max-width: 920px) 100vw, 48vw"
        src={`/parent/slides/${slides[slideIndex]}`}
      />
      <div className="parent-photo-slider-shade" />
      <div className="parent-photo-slider-brand">
        <Image alt="TribePetra Kids" className="parent-photo-slider-logo" height={58} src="/brand/tpk-logo.png" width={300} style={{ filter: "none", mixBlendMode: "normal" }} />
        <span>Wuse Campus</span>
      </div>
      <div className="parent-photo-slider-copy">
        <h2>Building Jesus<br />Kids Communities<br />Globally.</h2>
        <i />
        <p>A warm, fun and safe place for every child to belong, learn and grow.</p>
      </div>
      <small className="parent-photo-slider-footer">Check in &nbsp;•&nbsp; Belong &nbsp;•&nbsp; Grow</small>
    </aside>
  );
}
