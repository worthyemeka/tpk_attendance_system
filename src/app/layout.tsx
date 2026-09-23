import type { Metadata } from "next";
import { DM_Serif_Display, Manrope } from "next/font/google";
import "./globals.css";
import "./check-in.css";
import "./teacher-layout.css";
import { AppShell } from "@/components/app-shell";
import { GlobalDropdowns } from "@/components/app-dropdown";
import { DisplayTypography } from "@/components/display-typography";

const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
const display = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-display" });
export const metadata: Metadata = { title: "TribePetra Kids | Wuse", description: "Child check-in and pickup", icons: { icon: "/brand/tpk-logo.jpg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${body.variable} ${display.variable}`}><AppShell>{children}</AppShell><GlobalDropdowns /><DisplayTypography /></body></html>;
}
