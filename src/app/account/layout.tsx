import "@/components/records-system.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/account");
export default function PageLayout({ children }: { children: React.ReactNode }) { return children; }
