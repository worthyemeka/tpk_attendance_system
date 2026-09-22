"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiChevronRight, FiFilePlus, FiHelpCircle, FiUsers } from "react-icons/fi";

const slides = ["slide-1.jpeg", "slide-2.jpeg", "slide-3.jpeg", "slide-4.jpeg", "slide-5.jpeg"];

export function PublicHome() {
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const photoTimer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 5500);
    const timeTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearInterval(photoTimer); window.clearInterval(timeTimer); };
  }, []);
  const date = now ? new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(now) : "";
  return <main className="public-home">
    <aside className="public-photos" aria-label="TribePetra Kids moments">
      {slides.map((image, index) => <div className={`public-photo ${index === slide ? "visible" : ""}`} style={{ backgroundImage: `url('/parent/slides/${image}')` }} key={image} />)}
      <div className="public-photo-overlay" />
      <div className="public-brand"><img src="/brand/petra-logo.jpg" alt="Petra Church" /><span><b>TRIBEPETRA KIDS</b><small>WUSE CAMPUS</small></span></div>
      <div className="public-message"><h1>Safe<br />Children.<br />Stronger<br />Tomorrow.</h1><i /><p>A warm, fun and safe place for every child to belong, learn and grow.</p></div>
      <div className="public-slide-dots">{slides.map((image, index) => <i key={image} className={index === slide ? "active" : ""} />)}</div>
      <small className="public-tagline">CHECK IN · BELONG · GROW</small>
    </aside>
    <section className="public-main">
      <time>{date}</time>
      <div className="public-shape top" /><div className="public-shape side" /><div className="public-shape bottom" />
      <div className="public-inner">
        <p className="public-eyebrow">WELCOME TO</p>
        <h2>TribePetra Kids</h2><strong>WUSE CAMPUS</strong>
        <p className="public-intro">Let&apos;s get the kids checked in.</p>
        <div className="public-actions">
          <Link className="public-action returning" href="/check-in/parent"><i><FiUsers /></i><span><b>We’ve been here before</b><em>Quick Check-In</em><small>Check in your child or children in a few seconds.</small></span><FiChevronRight /></Link>
          <Link className="public-action new" href="/check-in/parent?flow=new"><i><FiFilePlus /></i><span><b>This is our first time</b><em>Register & Check In</em><small>Add your child&apos;s details and check them in.</small></span><FiChevronRight /></Link>
        </div>
        <div className="public-help"><FiHelpCircle /><div><b>Need help?</b><span>See a TribePetra Kids volunteer at the check-in area.</span></div></div>
      </div>
    </section>
    <style jsx global>{`
      .public-home{min-height:100vh;display:grid;grid-template-columns:minmax(360px,48vw) 1fr;background:#fffdf9;color:#06142d;font-family:var(--font-body)}.public-photos{position:fixed;inset:0 auto 0 0;width:48vw;overflow:hidden;background:#112317;color:#fff}.public-photo{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.04);transition:opacity 1s ease,transform 6.5s ease}.public-photo.visible{opacity:1;transform:scale(1)}.public-photo-overlay{position:absolute;inset:0;background:linear-gradient(180deg,#06140b5e 5%,#06140b10 46%,#041208c9 100%)}.public-brand,.public-message,.public-tagline,.public-slide-dots{position:absolute;z-index:1}.public-brand{left:8%;top:6%;display:flex;align-items:center;gap:13px}.public-brand img{width:65px;height:65px;border-radius:50%;object-fit:contain;filter:brightness(0) invert(1)}.public-brand b,.public-brand small{display:block}.public-brand b{letter-spacing:1px;font-size:15px}.public-brand small{margin-top:3px;letter-spacing:1px;font-size:11px}.public-message{left:8%;bottom:15%;max-width:285px}.public-message h1{margin:0;font:700 clamp(39px,4vw,61px)/1.03 Georgia,serif;letter-spacing:-1.5px}.public-message i{display:block;width:65px;height:5px;border-radius:20px;background:#ffcf67;margin:22px 0}.public-message p{margin:0;font-size:18px;line-height:1.42}.public-tagline{left:8%;bottom:5%;letter-spacing:2.9px;font-size:9px;font-weight:900}.public-slide-dots{right:7%;bottom:6%;display:flex;gap:7px}.public-slide-dots i{width:6px;height:6px;border-radius:50%;background:#ffffff75}.public-slide-dots i.active{width:21px;border-radius:6px;background:#fff}.public-main{grid-column:2;min-height:100vh;position:relative;overflow:hidden;padding:44px clamp(34px,8vw,132px);background:#fffdf9}.public-main>time{position:absolute;right:6.5%;top:46px;color:#4b638c;font-size:13px;font-weight:600}.public-inner{width:min(100%,690px);margin:clamp(90px,16vh,180px) auto 0;position:relative;z-index:1}.public-eyebrow{text-align:center;letter-spacing:5px;color:#3c5a87;font-size:13px;font-weight:900;margin:0}.public-inner h2{text-align:center;font-size:51px;line-height:1;margin:21px 0 11px;font-weight:900;letter-spacing:-2.6px}.public-inner>strong{display:block;text-align:center;color:#3d5a87;letter-spacing:5px;font-size:15px}.public-intro{text-align:center;color:#4e6894;font-size:19px;margin:20px 0 55px}.public-actions{display:grid;gap:21px}.public-action{min-height:150px;padding:25px 29px;border-radius:16px;text-decoration:none;color:#07152d;display:flex;align-items:center;gap:20px;transition:transform .18s ease,box-shadow .18s ease}.public-action:hover{transform:translateY(-2px);box-shadow:0 12px 25px #51311c17}.public-action.returning{background:linear-gradient(110deg,#fff0dc,#fffaf0)}.public-action.new{background:linear-gradient(110deg,#dff8ed,#edf9f4)}.public-action>i{width:65px;height:65px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:29px;flex:none}.public-action.returning>i{background:#ffd79c;color:#e74a22}.public-action.new>i{background:#bcefd6;color:#087e5d}.public-action span{display:grid;gap:4px;flex:1}.public-action b{font-size:20px}.public-action em{font-size:16px;font-style:normal}.public-action small{font-size:13px;color:#4d678f}.public-action>svg{width:49px;height:49px;padding:12px;border-radius:50%;background:#fff;color:#f35229}.public-action.new>svg{color:#0b9a65}.public-help{display:flex;gap:15px;border-top:1px solid #d5dbe3;padding:29px 13px 0;margin-top:38px;color:#3e5984;align-items:center}.public-help svg{font-size:32px}.public-help b,.public-help span{display:block}.public-help b{font-size:14px}.public-help span{font-size:12px;margin-top:4px}.public-shape{position:absolute;border-radius:40% 60% 50% 50%;opacity:.9}.public-shape.top{width:98px;height:115px;background:#ffd66f;left:1%;top:-25px;transform:rotate(31deg)}.public-shape.side{width:105px;height:120px;background:#f6c7d3;right:-30px;top:13%;transform:rotate(-31deg)}.public-shape.bottom{width:96px;height:110px;background:#6ed38e;right:-38px;bottom:-20px;transform:rotate(36deg)}@media(max-width:850px){.public-home{display:block}.public-photos{display:none}.public-main{min-height:100vh;padding:26px 21px 38px}.public-main>time{top:25px;right:21px;font-size:11px}.public-inner{margin-top:112px;max-width:580px}.public-inner h2{font-size:43px}.public-intro{margin-bottom:38px}.public-action{min-height:122px;padding:19px}.public-action b{font-size:17px}.public-action em{font-size:14px}.public-action small{font-size:11px}}@media(max-width:440px){.public-main{padding:20px 16px 28px}.public-main>time{right:16px;top:19px;font-size:10px}.public-inner{margin-top:97px}.public-eyebrow{font-size:10px;letter-spacing:3px}.public-inner h2{font-size:35px;letter-spacing:-1.8px;margin:14px 0 8px}.public-inner>strong{font-size:10px;letter-spacing:3px}.public-intro{font-size:16px;margin:16px 0 27px}.public-actions{gap:12px}.public-action{min-height:110px;padding:15px 13px;gap:12px;border-radius:12px}.public-action>i{width:47px;height:47px;font-size:21px}.public-action b{font-size:14px}.public-action em{font-size:12px}.public-action small{font-size:10px;line-height:1.3}.public-action>svg{width:35px;height:35px;padding:9px}.public-help{margin-top:27px;padding:21px 3px 0}.public-help svg{font-size:26px}.public-help b{font-size:12px}.public-help span{font-size:10px}}
    `}</style>
  </main>;
}
