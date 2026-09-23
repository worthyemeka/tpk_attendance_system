import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./check-in.css";
import { AppShell } from "@/components/app-shell";
import { GlobalDropdowns } from "@/components/app-dropdown";

const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
export const metadata: Metadata = { title: "TribePetra Kids | Wuse", description: "Child check-in and pickup", icons: { icon: "/brand/tpk-logo.jpg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={body.variable}><AppShell>{children}</AppShell><GlobalDropdowns /></body></html>;
}
