"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiChevronRight, FiFilePlus, FiHelpCircle, FiUsers } from "react-icons/fi";

const slides = [
  "slide-1.jpeg",
  "slide-2.jpeg",
  "slide-3.jpeg",
  "slide-4.jpeg",
  "slide-5.jpeg",
  "slide-6.jpeg",
  "slide-7.jpeg",
  "slide-8.jpeg",
  "slide-9.jpeg",
  "slide-10.jpeg",
  "slide-11.jpeg",
];

function currentDate() {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date());
}

export function PublicHome() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [date, setDate] = useState("");

  useEffect(() => {
    const updateDate = () => setDate(currentDate());
    updateDate();
    const clock = window.setInterval(updateDate, 30_000);
    const slideshow = window.setInterval(
      () => setActiveSlide((current) => (current + 1) % slides.length),
      5_000,
    );

    return () => {
      window.clearInterval(clock);
      window.clearInterval(slideshow);
    };
  }, []);

  return (
    <div className="public-home">
      <aside className="public-photos" aria-label="TribePetra Kids moments">
        {slides.map((slide, index) => (
          <div
            aria-hidden={index !== activeSlide}
            className={`public-photo ${index === activeSlide ? "is-active" : ""}`}
            key={slide}
            style={{ backgroundImage: `url('/parent/slides/${slide}')` }}
          />
        ))}
        <div className="public-photo-shade" />

        <div className="public-brand">
          <Image
            alt="TribePetra Kids"
            className="public-brand-logo"
            height={54}
            priority
            src="/brand/tpk-logo.jpg"
            width={200}
          />
          <small>Wuse Campus</small>
        </div>

        <div className="public-message">
          <h1>
            Building Jesus
            <br />
            Kids Communities
            <br />
            Globally.
          </h1>
          <span />
          <p>A warm, fun and safe place for every child to belong, learn and grow.</p>
        </div>

        <p className="public-photo-footer">Check in &nbsp;•&nbsp; Belong &nbsp;•&nbsp; Grow</p>
      </aside>

      <section className="public-content">
        <p className="public-date">{date}</p>
        <div className="public-decor public-decor-yellow" />
        <div className="public-decor public-decor-pink" />
        <div className="public-decor public-decor-green" />

        <div className="public-intro">
          <p className="eyebrow">Welcome to</p>
          <h2>TribePetra Kids</h2>
          <p className="campus">Wuse Campus</p>
          <p className="public-subtitle">Let’s get the kids checked in.</p>
        </div>

        <div className="public-actions">
          <Link className="public-action returning" href="/check-in/parent">
            <span className="public-action-icon"><FiUsers /></span>
            <span>
              <strong>We’ve been here before</strong>
              <b>Quick Check-In</b>
              <small>Check in your child or children in a few seconds.</small>
            </span>
            <FiChevronRight className="public-arrow" />
          </Link>

          <Link className="public-action new" href="/check-in/parent?flow=new">
            <span className="public-action-icon"><FiFilePlus /></span>
            <span>
              <strong>This is our first time</strong>
              <b>Register &amp; Check In</b>
              <small>Add your child’s details and check them in.</small>
            </span>
            <FiChevronRight className="public-arrow" />
          </Link>
        </div>

        <div className="public-help">
          <FiHelpCircle />
          <span><b>Need help?</b><small>See a TribePetra Kids volunteer at the check-in area.</small></span>
        </div>

        <p className="public-signoff">Safe Children<br />Stronger Tomorrow</p>
      </section>

      <style jsx global>{`
        .parent-shell { min-height: 100vh; }
        .public-home { min-height: 100vh; background: #fffdf9; color: #071a36; display: flex; overflow: hidden; font-family: var(--font-sans, Arial, sans-serif); }
        .public-photos { width: 48%; min-height: 100vh; position: fixed; inset: 0 auto 0 0; overflow: hidden; color: #fff; background: #10231e; }
        .public-photo, .public-photo-shade { position: absolute; inset: 0; }
        .public-photo { background-size: cover; background-position: center; opacity: 0; transform: scale(1.03); transition: opacity 900ms ease, transform 6s ease; }
        .public-photo.is-active { opacity: 1; transform: scale(1); }
        .public-photo-shade { background: linear-gradient(90deg, rgba(0, 0, 0, .42), rgba(0, 0, 0, .08) 60%, rgba(0, 0, 0, .18)); z-index: 1; }
        .public-brand { position: absolute; z-index: 2; top: 42px; left: 62px; display: grid; gap: 3px; }
        .public-brand-logo { width: 200px; height: 54px; object-fit: contain; object-position: left; filter: brightness(0) invert(1); }
        .public-brand small { margin-left: 6px; text-transform: uppercase; font-size: 13px; line-height: 1; letter-spacing: .13em; font-weight: 700; }
        .public-message { position: absolute; z-index: 2; left: 64px; bottom: 20%; max-width: 390px; }
        .public-message h1 { margin: 0; color: white; font-size: clamp(38px, 4.3vw, 64px); line-height: 1.03; letter-spacing: -.045em; font-family: var(--font-display, Georgia, serif); }
        .public-message > span { display: block; width: 76px; height: 5px; border-radius: 99px; margin: 24px 0; background: #ffd16d; transform: rotate(-3deg); }
        .public-message p { margin: 0; max-width: 270px; font-size: 19px; line-height: 1.42; }
        .public-photo-footer { position: absolute; z-index: 2; left: 64px; bottom: 40px; margin: 0; text-transform: uppercase; letter-spacing: .18em; font-size: 11px; font-weight: 800; }
        .public-content { position: relative; width: 52%; min-height: 100vh; margin-left: 48%; padding: 46px clamp(36px, 7vw, 118px) 40px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
        .public-date { position: absolute; right: clamp(36px, 7vw, 110px); top: 46px; margin: 0; color: #536889; font-size: 15px; font-weight: 600; }
        .public-intro { position: relative; z-index: 1; text-align: center; margin: 0 auto 50px; }
        .public-intro .eyebrow, .public-intro .campus { text-transform: uppercase; letter-spacing: .3em; color: #365687; font-size: 13px; font-weight: 800; margin: 0; }
        .public-intro h2 { margin: 15px 0 5px; font-size: clamp(42px, 4.1vw, 68px); line-height: .95; letter-spacing: -.06em; }
        .public-intro .campus { font-size: 12px; }
        .public-subtitle { margin: 20px 0 0; color: #4a6289; font-size: 21px; }
        .public-actions { position: relative; z-index: 1; display: grid; gap: 20px; width: min(100%, 680px); margin: 0 auto; }
        .public-action { min-height: 132px; padding: 22px 28px; display: grid; grid-template-columns: 74px 1fr 44px; align-items: center; gap: 20px; border-radius: 15px; text-decoration: none; color: #071a36; transition: transform 180ms ease, box-shadow 180ms ease; }
        .public-action:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(24, 54, 87, .12); }
        .public-action.returning { background: #fff4e4; }
        .public-action.new { background: #e8f9f2; }
        .public-action-icon { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 30px; }
        .returning .public-action-icon { color: #ec3d18; background: #ffe0a8; }
        .new .public-action-icon { color: #008969; background: #bdf0d9; }
        .public-action strong, .public-action b, .public-action small { display: block; }
        .public-action strong { font-size: 20px; line-height: 1.2; }
        .public-action b { font-size: 17px; font-weight: 500; margin-top: 3px; }
        .public-action small { color: #46638a; font-size: 14px; margin-top: 6px; }
        .public-arrow { justify-self: end; width: 42px; height: 42px; padding: 10px; border-radius: 50%; background: #fff; color: #f54a25; font-size: 25px; }
        .new .public-arrow { color: #00a86f; }
        .public-help { position: relative; z-index: 1; width: min(100%, 680px); margin: 36px auto 0; padding: 28px 14px 0; border-top: 1px solid #d7dee8; display: flex; align-items: center; gap: 20px; color: #425f89; }
        .public-help svg { width: 44px; height: 44px; }
        .public-help b, .public-help small { display: block; }
        .public-help b { color: #0b203f; font-size: 16px; }
        .public-help small { margin-top: 4px; font-size: 14px; }
        .public-signoff { position: absolute; right: clamp(36px, 7vw, 110px); bottom: 36px; margin: 0; font-family: cursive; color: #0e1d36; font-size: 20px; line-height: .95; text-align: center; transform: rotate(-7deg); }
        .public-decor { position: absolute; z-index: 0; border-radius: 50% 38% 52% 45%; opacity: .8; }
        .public-decor-yellow { width: 105px; height: 130px; top: -15px; left: 5%; background: #ffd36f; transform: rotate(31deg); }
        .public-decor-pink { width: 90px; height: 140px; top: 110px; right: -40px; background: #f7cad8; transform: rotate(-31deg); }
        .public-decor-green { width: 125px; height: 160px; right: -58px; bottom: -62px; background: #8ed6aa; transform: rotate(-28deg); }
        @media (max-width: 1050px) { .public-content { padding-left: 44px; padding-right: 44px; } .public-brand { left: 38px; } .public-message, .public-photo-footer { left: 40px; } .public-message { bottom: 18%; } .public-action { padding: 18px; gap: 14px; } }
        @media (max-width: 850px) { .public-home { display: block; overflow: auto; } .public-photos { display: none; } .public-content { width: 100%; min-height: 100vh; margin: 0; padding: 88px 22px 38px; justify-content: flex-start; } .public-date { top: 24px; right: 22px; font-size: 13px; } .public-intro { margin: 36px auto 36px; } .public-intro h2 { font-size: clamp(42px, 12vw, 60px); } .public-subtitle { font-size: 18px; } .public-action { grid-template-columns: 58px 1fr 34px; min-height: 110px; padding: 18px; gap: 13px; } .public-action-icon { width: 52px; height: 52px; font-size: 24px; } .public-action strong { font-size: 16px; } .public-action b { font-size: 15px; } .public-action small { font-size: 12px; line-height: 1.35; } .public-arrow { width: 34px; height: 34px; padding: 7px; font-size: 20px; } .public-help { margin-top: 28px; padding-top: 22px; } .public-help svg { width: 35px; height: 35px; flex: 0 0 auto; } .public-signoff { position: static; margin: 34px 12px 0 auto; font-size: 17px; } .public-decor-yellow { left: -30px; } }
        @media (max-width: 440px) { .public-content { padding-left: 16px; padding-right: 16px; } .public-date { right: 16px; } .public-action { grid-template-columns: 48px 1fr 28px; padding: 15px 13px; } .public-action-icon { width: 45px; height: 45px; } .public-action small { display: none; } .public-help { padding-left: 4px; gap: 12px; } .public-help small { font-size: 12px; } }
      `}</style>
    </div>
  );
}
