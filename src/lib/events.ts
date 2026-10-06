import { campusToday } from "./registration-eligibility";
export type MinistryEvent={id:number;name:string;type:string;startDate:string;endDate:string;status:string;countdown:boolean;registrationOpens?:string;registrationCloses?:string;description?:string;publicRegistration?:boolean;publicKey?:string;summary?:EventSummary};
export type EventSummary={registered:number;volunteers:number;careNotes:number;checkedIn:number;awaitingPickup:number};
export type EventSession={id:number;name:string;startsAt:string;endsAt:string;expected?:number;attended?:number;awaitingPickup?:number};
export function eventCountdown(event:MinistryEvent,now=new Date()) {
 const today=campusToday(now);if(event.status==="CANCELLED")return "Cancelled";
 if(today>event.endDate)return "Event completed";
 if(today>=event.startDate){const day=Math.round((Date.parse(today)-Date.parse(event.startDate))/86400000)+1;const total=Math.round((Date.parse(event.endDate)-Date.parse(event.startDate))/86400000)+1;return `Day ${day} of ${total}`;}
 const diff=Math.max(0,Date.parse(event.startDate+"T00:00:00+01:00")-now.getTime());return `Starts in ${Math.floor(diff/86400000)} days, ${Math.floor(diff/3600000)%24} hours`;
}
export function eventDate(value:string){const day=value.slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(day)?new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z")):"—";}
