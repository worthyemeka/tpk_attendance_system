import { PublicHome } from "@/components/public-home";
import Link from "next/link";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = pageMetadata("/");

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "TribePetra Kids", alternateName: "TPK Wuse", url: SITE_URL, publisher: { "@type": "Organization", name: "TribePetra Kids — Petra Church, Wuse Campus", url: SITE_URL, logo: `${SITE_URL}/brand/tpk-logo.png` } }).replace(/</g, "\\u003c") }} /><PublicHome /><style>{`
    .homepage-teacher-link{position:fixed;z-index:25;top:46px;left:calc(48% + clamp(36px,7vw,118px));color:#e84929;text-decoration:none;font:800 13px var(--font-body,Arial,sans-serif)}
    @media(max-width:850px){.homepage-teacher-link{top:22px;left:22px;font-size:12px}.public-date{top:51px!important;right:22px!important}}
    @media(max-width:440px){.homepage-teacher-link{left:12px;font-size:10px}.public-date{right:12px!important;font-size:11px!important}}
  `}</style></>;
}
