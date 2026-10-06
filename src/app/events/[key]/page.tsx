import { PublicEventRegistration } from "@/components/events-workspace";
export default function Page({params}:{params:{key:string}}){return <PublicEventRegistration eventKey={params.key}/>;}
