"use client";

import { ParentPhotoSlider } from "@/components/parent-photo-slider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiChevronRight, FiFilePlus, FiHelpCircle, FiUsers } from "react-icons/fi";

function displayDate() {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date());
}

export function PublicHome() {
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => setDate(displayDate());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="public-home">
      <ParentPhotoSlider />
      <section className="public-content">
        <p className="public-date">{date}</p>
        <div className="public-decor public-decor-yellow" />
        <div className="public-decor public-decor-pink" />
        <div className="public-decor public-decor-green" />
        <div className="public-intro"><p className="eyebrow">Welcome to</p><h1>TribePetra Kids</h1><p className="campus">Wuse Campus</p><p className="public-subtitle">Let’s get the kids checked in.</p></div>
        <div className="public-actions">
          <Link className="public-action returning" href="/check-in/parent"><span className="public-action-icon"><FiUsers /></span><span><strong>We’ve been here before</strong><b>Quick Check-In</b><small>Check in your child or children in a few seconds.</small></span><FiChevronRight className="public-arrow" /></Link>
          <Link className="public-action new" href="/check-in/parent?flow=new"><span className="public-action-icon"><FiFilePlus /></span><span><strong>This is our first time</strong><b>Register &amp; Check In</b><small>Add your child’s details and check them in.</small></span><FiChevronRight className="public-arrow" /></Link>
        </div>
        <div className="public-help"><FiHelpCircle /><span><b>Need help?</b><small>See a TribePetra Kids volunteer at the check-in area.</small></span></div>
        <p className="public-signoff">Safe Children<br />Stronger Tomorrow</p>
      </section>
      <style jsx global>{`
        .parent-shell { min-height: 100vh; }.public-home { min-height: 100vh; display: flex; overflow: hidden; background: #fffdf9; color: #071a36; font-family: var(--font-body, Arial, sans-serif); }
        .parent-photo-slider { position: fixed; inset: 0 auto 0 0; width: min(48vw, 770px); overflow: hidden; background: #11241c; color: #fff; }.parent-photo-slider-image { object-fit: cover; object-position: center; animation: public-image-in 700ms ease both; }.parent-photo-slider-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(1,12,8,.55), rgba(2,14,9,.08) 65%),linear-gradient(0deg,rgba(0,0,0,.53),transparent 54%); }.parent-photo-slider-brand { position: absolute; z-index: 1; top: 42px; left: 58px; display: grid; gap: 4px; }.parent-photo-slider-logo { width: 175px; height: 51px; object-fit: contain; object-position: left; }.parent-photo-slider-brand span { margin-left: 5px; text-transform: uppercase; letter-spacing: .15em; font-size: 12px; font-weight: 800; }.parent-photo-slider-copy { position: absolute; z-index: 1; left: 62px; bottom: 136px; max-width: 355px; }.parent-photo-slider-copy h2 { margin: 0; color: white; font: 700 clamp(38px,4vw,59px)/1.02 Georgia,serif; letter-spacing: -.045em; }.parent-photo-slider-copy i { display: block; width: 70px; height: 5px; margin: 22px 0; border-radius: 99px; background: #ffd26d; transform: rotate(-3deg); }.parent-photo-slider-copy p { max-width: 255px; margin: 0; font-size: 17px; line-height: 1.42; }.parent-photo-slider-footer { position: absolute; z-index: 1; left: 62px; bottom: 42px; text-transform: uppercase; letter-spacing: .2em; font-size: 10px; font-weight: 900; }
        .public-content { position: relative; width: 52%; min-height: 100vh; margin-left: 48%; padding: 46px clamp(36px,7vw,118px) 40px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }.public-date { position: absolute; top: 46px; right: clamp(36px,7vw,110px); margin: 0; color: #536889; font-size: 15px; font-weight: 600; }.public-intro { position: relative; z-index: 1; margin: 0 auto 48px; text-align: center; }.public-intro .eyebrow,.public-intro .campus { margin: 0; color: #365687; text-transform: uppercase; letter-spacing: .3em; font-size: 13px; font-weight: 800; }.public-intro h1 { margin: 15px 0 5px; font-size: clamp(42px,4.1vw,68px); line-height: .95; letter-spacing: -.06em; }.public-intro .campus { font-size: 12px; }.public-subtitle { margin: 20px 0 0; color: #4a6289; font-size: 21px; }.public-actions { position: relative; z-index: 1; width: min(100%,680px); display: grid; gap: 20px; margin: 0 auto; }.public-action { min-height: 130px; display: grid; grid-template-columns: 74px 1fr 44px; align-items: center; gap: 20px; border-radius: 15px; padding: 22px 28px; color: #071a36; text-decoration: none; transition: transform 180ms ease,box-shadow 180ms ease; }.public-action:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(24,54,87,.12); }.public-action.returning { background: #fff4e4; }.public-action.new { background: #e8f9f2; }.public-action-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; font-size: 30px; }.returning .public-action-icon { color: #ec3d18; background: #ffe0a8; }.new .public-action-icon { color: #008969; background: #bdf0d9; }.public-action strong,.public-action b,.public-action small { display: block; }.public-action strong { font-size: 20px; line-height: 1.2; }.public-action b { margin-top: 3px; font-size: 17px; font-weight: 500; }.public-action small { margin-top: 6px; color: #46638a; font-size: 14px; }.public-arrow { justify-self: end; width: 42px; height: 42px; padding: 10px; border-radius: 50%; background: white; color: #f54a25; font-size: 25px; }.new .public-arrow { color: #00a86f; }.public-help { position: relative; z-index: 1; width: min(100%,680px); display: flex; align-items: center; gap: 20px; margin: 36px auto 0; padding: 28px 14px 0; border-top: 1px solid #d7dee8; color: #425f89; }.public-help svg { width: 44px; height: 44px; }.public-help b,.public-help small { display: block; }.public-help b { color: #0b203f; font-size: 16px; }.public-help small { margin-top: 4px; font-size: 14px; }.public-signoff { position: absolute; right: clamp(36px,7vw,110px); bottom: 36px; margin: 0; color: #0e1d36; text-align: center; font-family: cursive; font-size: 20px; line-height: .95; transform: rotate(-7deg); }.public-decor { position: absolute; z-index: 0; border-radius: 50% 38% 52% 45%; opacity: .8; }.public-decor-yellow { width: 105px; height: 130px; top: -15px; left: 5%; background: #ffd36f; transform: rotate(31deg); }.public-decor-pink { width: 90px; height: 140px; top: 110px; right: -40px; background: #f7cad8; transform: rotate(-31deg); }.public-decor-green { width: 125px; height: 160px; right: -58px; bottom: -62px; background: #8ed6aa; transform: rotate(-28deg); }
        @keyframes public-image-in { from { opacity: .35; transform: scale(1.04); } to { opacity: 1; transform: scale(1); } }
        @media(max-width:1050px) { .public-content { padding-left: 44px; padding-right: 44px; }.parent-photo-slider-brand { left: 36px; }.parent-photo-slider-copy,.parent-photo-slider-footer { left: 40px; }.public-action { padding: 18px; gap: 14px; } }
        @media(max-width:850px) { .public-home { display: block; overflow: auto; padding: 0 12px; }.parent-photo-slider { position: relative; width: 100%; min-height: 225px; border-radius: 0 0 22px 22px; }.parent-photo-slider-brand { top: 19px; left: 21px; }.parent-photo-slider-logo { width: 150px; height: 42px; }.parent-photo-slider-copy { left: 23px; bottom: 25px; }.parent-photo-slider-copy h2 { font-size: 32px; }.parent-photo-slider-copy i,.parent-photo-slider-copy p,.parent-photo-slider-footer { display: none; }.public-content { width: 100%; min-height: auto; margin: 0; padding: 88px 22px 38px; justify-content: flex-start; }.public-date { top: 24px; right: 22px; font-size: 13px; }.public-intro { margin: 36px auto; }.public-intro h1 { font-size: clamp(42px,12vw,60px); }.public-subtitle { font-size: 18px; }.public-action { min-height: 110px; grid-template-columns: 58px 1fr 34px; gap: 13px; padding: 18px; }.public-action-icon { width: 52px; height: 52px; font-size: 24px; }.public-action strong { font-size: 16px; }.public-action b { font-size: 15px; }.public-action small { font-size: 12px; line-height: 1.35; }.public-arrow { width: 34px; height: 34px; padding: 7px; font-size: 20px; }.public-help { margin-top: 28px; padding-top: 22px; }.public-help svg { width: 35px; height: 35px; flex: 0 0 auto; }.public-signoff { position: static; margin: 34px 12px 0 auto; font-size: 17px; } }
        @media(max-width:440px) { .public-home { padding: 0 9px; }.parent-photo-slider { min-height: 185px; border-radius: 0 0 18px 18px; }.parent-photo-slider-brand { top: 15px; left: 17px; }.parent-photo-slider-logo { width: 130px; height: 37px; }.parent-photo-slider-brand span { font-size: 9px; }.parent-photo-slider-copy { left: 18px; bottom: 18px; }.parent-photo-slider-copy h2 { font-size: 27px; }.public-content { padding-left: 7px; padding-right: 7px; }.public-date { right: 12px; }.public-action { grid-template-columns: 48px 1fr 28px; padding: 15px 13px; }.public-action-icon { width: 45px; height: 45px; }.public-action small { display: none; }.public-help { padding-left: 4px; gap: 12px; }.public-help small { font-size: 12px; } }
      `}</style>
    </div>
  );
}
