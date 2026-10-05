/** MySQL DATETIME values are campus-local; browsers must not guess their zone. */
export function parseCampusTime(value:string):Date {
  return new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value)?value.replace(" ","T")+"+01:00":value);
}
