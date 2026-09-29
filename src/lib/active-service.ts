export type ActiveService = { id:number; label:string; serviceType?:string; serviceDate?:string };

export function readActiveService(): ActiveService | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("tpk:active-service");
    if (!raw) return null;
    const value = JSON.parse(raw) as ActiveService;
    return Number.isFinite(value.id) ? value : null;
  } catch { return null; }
}

export function setActiveService(service: ActiveService) {
  window.localStorage.setItem("tpk:active-service", JSON.stringify(service));
  window.localStorage.setItem("tpk:selected-service", service.label);
  window.dispatchEvent(new CustomEvent<ActiveService>("tpk:service", { detail:service }));
}

export function clearActiveService() {
  window.localStorage.removeItem("tpk:active-service");
  window.localStorage.removeItem("tpk:selected-service");
  window.dispatchEvent(new CustomEvent<ActiveService | null>("tpk:service", { detail:null }));
}

export function subscribeToActiveService(callback:(service:ActiveService|null)=>void) {
  const listener = (event:Event) => callback((event as CustomEvent<ActiveService | null>).detail ?? readActiveService());
  callback(readActiveService());
  window.addEventListener("tpk:service", listener);
  return () => window.removeEventListener("tpk:service", listener);
}
