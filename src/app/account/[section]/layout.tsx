import { sectionMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { section: string } }) { return sectionMetadata(params.section); }
export default function SectionLayout({ children }: { children: React.ReactNode }) { return children; }
