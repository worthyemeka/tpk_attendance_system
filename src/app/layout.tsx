import type { Metadata } from "next";
import "./globals.css";
import "./typography.css";
import "./dropdowns.css";
import "./responsive-ui.css";
import "./check-in.css";
import "./teacher-layout.css";
import "./loading.css";
import { AppShell } from "@/components/app-shell";
import { GlobalDropdowns } from "@/components/app-dropdown";
import { DisplayTypography } from "@/components/display-typography";

export const metadata: Metadata = { title: "TribePetra Kids | Wuse", description: "Child check-in and pickup", icons: { icon: "/brand/tpk-logo.jpg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppShell>{children}</AppShell><GlobalDropdowns /><DisplayTypography /></body></html>;
}
