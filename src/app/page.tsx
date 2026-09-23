import { PublicHome } from "@/components/public-home";
import Link from "next/link";

export default function HomePage() {
  return <><Link className="homepage-teacher-link" href="/teacher/login">Teacher sign in</Link><PublicHome /><style>{`
    .homepage-teacher-link{position:fixed;z-index:25;top:43px;right:clamp(36px,7vw,110px);color:#e84929;text-decoration:none;font:800 13px var(--font-body,Arial,sans-serif)}
    .public-date{right:clamp(175px,20vw,270px)!important}@media(max-width:850px){.homepage-teacher-link{top:24px;right:18px;font-size:12px}.public-date{right:132px!important}}@media(max-width:440px){.homepage-teacher-link{font-size:10px}.public-date{right:112px!important;font-size:11px!important}}
  `}</style></>;
}
