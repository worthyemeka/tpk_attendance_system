import { campusToday } from "./registration-eligibility";
export type MinistryEvent={id:number;name:string;type:string;startDate:string;endDate:string;status:string;lifecycle?:string;themeName?:string;themeSongUrl?:string;timezone?:string;countdown:boolean;registrationOpens?:string;registrationCloses?:string;description?:string;publicRegistration?:boolean;publicKey?:string;summary?:EventSummary};
export type EventSummary={registered:number;volunteers:number;careNotes:number;checkedIn:number;awaitingPickup:number};
export type EventSession={id:number;dayId?:number;name:string;startsAt:string;endsAt:string;expected?:number;attended?:number;awaitingPickup?:number};
export function eventCountdown(event:MinistryEvent,now=new Date()) {
 const today=eventToday(event,now);if(event.status==="CANCELLED")return "Cancelled";if(event.status==="ARCHIVED")return "Archived event";
 if(today>event.endDate)return "Event completed";
 if(today>=event.startDate){const day=Math.round((Date.parse(today)-Date.parse(event.startDate))/86400000)+1;const total=Math.round((Date.parse(event.endDate)-Date.parse(event.startDate))/86400000)+1;return `Day ${day} of ${total}`;}
 const diff=Math.max(0,Date.parse(event.startDate+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"));return `Starts in ${Math.round(diff/86400000)} days`;
}
export function eventToday(event:MinistryEvent,now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone||'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(key:string)=>parts.find(p=>p.type===key)?.value;return `${get("year")}-${get("month")}-${get("day")}`;}
export function eventLifecycle(event:MinistryEvent,now=new Date()){const today=eventToday(event,now);return ['DRAFT','CANCELLED','ARCHIVED'].includes(event.status)?event.status:today<event.startDate?'UPCOMING':today>event.endDate?'COMPLETED':'LIVE';}
export function eventDate(value:string){const day=value.slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(day)?new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z")):"—";}
