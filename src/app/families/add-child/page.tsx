import Link from "next/link";
import {SiblingRegistration} from "@/components/sibling-registration";
export const metadata={title:"Add a sibling | TribePetra Kids",robots:{index:false,follow:false}};
export default function AddSiblingPage(){return <main className="public-sibling-page"><Link href="/">← Back to TribePetra Kids</Link><SiblingRegistration/></main>;}
