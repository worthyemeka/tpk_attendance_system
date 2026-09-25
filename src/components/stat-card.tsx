"use client";

import type { ReactNode } from "react";
import "./stat-card.css";

export type StatCardTone = "orange" | "green" | "yellow" | "dark" | "blue" | "purple";

export function StatCard({ icon, value, title, description, tone = "orange", onClick, className = "" }: { icon: ReactNode; value: ReactNode; title: string; description: string; tone?: StatCardTone; onClick?: () => void; className?: string }) {
  const content = <><span className="tpk-stat-card__icon">{icon}</span><span className="tpk-stat-card__content"><strong>{value}</strong><b>{title}</b><small>{description}</small></span></>;
  return <article className={`tpk-stat-card tpk-stat-card--${tone} ${className}`}>{onClick ? <button onClick={onClick}>{content}</button> : content}</article>;
}
