import { campusToday, registrationEligibility } from "./registration-eligibility";

export function classForBirthDate<T extends { id:number; minAge:number; maxAge:number; displayOrder?:number }>(classes:T[], birth:string, today=campusToday()): T | undefined {
  if(registrationEligibility(birth,today)!=="ELIGIBLE")return undefined;
  const age=Number(today.slice(0,4))-Number(birth.slice(0,4))-(today.slice(5)<birth.slice(5)?1:0);
  return [...classes].sort((a,b)=>(a.displayOrder??999)-(b.displayOrder??999)||Number(a.id)-Number(b.id)).find(item=>item.minAge!=null&&item.maxAge!=null&&age>=Number(item.minAge)&&age<=Number(item.maxAge));
}
