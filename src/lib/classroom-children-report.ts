import type { TableReport } from "./table-pdf";

type ReportChild = {firstName:string;lastName:string;age?:number;guardianName?:string;guardianPhone?:string;todayStatus:string};
export function classroomChildrenReport(className:string,service:{name?:string;serviceDate?:string}|null|undefined,children:ReportChild[],filter="",search=""):TableReport {
  const date=service?.serviceDate?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${service.serviceDate}T12:00:00Z`)):"No service selected";
  const present=children.filter(child=>child.todayStatus==="PRESENT").length;
  const absent=children.filter(child=>child.todayStatus==="ABSENT").length;
  return {
    title:`${className} - Children`,
    subtitle:[date,service?.name,`${children.length} children | ${present} present | ${absent} absent`,filter?`${filter==="PRESENT"?"Present":"Absent"} only`:"All attendance",search?`Search: ${search}`:""].filter(Boolean).join(" | "),
    columns:["#","Child","Age","Guardian","Guardian phone","Attendance"],
    widths:[.3,1.8,.4,1.7,1.1,.8],
    rows:children.map((child,index)=>[String(index+1),`${child.firstName} ${child.lastName}`.trim(),String(child.age??"-"),child.guardianName||"Not recorded",child.guardianPhone||"Not recorded",child.todayStatus==="PRESENT"?"Present":child.todayStatus==="ABSENT"?"Absent":"Not expected"]),
  };
}
