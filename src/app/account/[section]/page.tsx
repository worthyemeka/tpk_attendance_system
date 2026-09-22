import { FiArrowLeft } from "react-icons/fi";
import Link from "next/link";

export default function AccountSection({ params }: { params: { section: string } }) {
  const title = params.section.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  return <section className="panel form-card"><p className="eyebrow">Petra Wuse</p><h1>{title}</h1><p className="intro">This staff area is being moved into the signed-in account workspace.</p><Link className="outline-button" href="/account/overview"><FiArrowLeft /> Back to overview</Link></section>;
}
