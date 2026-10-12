import { PublicEventRegistration } from "@/components/events-workspace";
export default function Page({params,searchParams}:{params:{key:string};searchParams:{preview?:string}}){
 const preview=Number(searchParams.preview);return <PublicEventRegistration eventKey={params.key} previewEventId={Number.isSafeInteger(preview)&&preview>0?preview:0}/>;
}
