"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { clearActiveService, setActiveService, type ActiveService } from "@/lib/active-service";

const TIME_ZONE = "Africa/Lagos";
const STORAGE_KEY = "tpk:sunday-context";

export type ServiceSessionContext = {
  id: number;
  campusId?: number;
  name: string;
  serviceDate: string;
  serviceType?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isOpen?: boolean;
};

export type SundayOption = { date: string; week: number; label: string };
export type MonthOption = { key: string; label: string; year: number; month: number };

type SavedContext = { selectedSundayDate?: string; selectedServiceSessionId?: number };
type SundayContextValue = {
  loading: boolean;
  error: string;
  retry: () => void;
  selectedYear: number | null;
  selectedMonth: number | null;
  selectedSundayDate: string | null;
  selectedServiceSessionId: number | null;
  selectedService: ServiceSessionContext | null;
  months: MonthOption[];
  sundays: SundayOption[];
  services: ServiceSessionContext[];
  selectMonth: (key: string) => void;
  selectSunday: (date: string) => void;
  selectService: (id: number) => void;
};

const Context = createContext<SundayContextValue | null>(null);

function currentLagosDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function dateKey(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function sundayOptions(year: number, month: number): SundayOption[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: Math.max(0, Math.floor((daysInMonth - firstSunday) / 7) + 1) }, (_, index) => {
    const day = firstSunday + index * 7;
    const date = dateKey(year, month, day);
    return { date, week: index + 1, label: `Week ${index + 1} · ${new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}` };
  });
}

function mostRecentSunday(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - value.getUTCDay());
  return value.toISOString().slice(0, 10);
}

function serviceTime(value?: string | null) {
  if (!value) return "";
  const time = value.includes(" ") ? value.split(" ").pop() || "" : value.split("T").pop() || value;
  const match = time.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

export function serviceDisplayLabel(service: Pick<ServiceSessionContext, "name" | "startsAt">) {
  const time = serviceTime(service.startsAt);
  return time ? `${service.name} · ${time}` : service.name;
}

function loadSaved(): SavedContext {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

function monthOptions(items: ServiceSessionContext[], selectedDate?: string | null): MonthOption[] {
  const keys = new Set<string>([currentLagosDate().slice(0, 7)]);
  items.forEach((item) => { if (item.serviceDate) keys.add(monthKey(item.serviceDate)); });
  if (selectedDate) keys.add(monthKey(selectedDate));
  return [...keys].sort().map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { key, year, month, label: new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))) };
  });
}

function pickService(items: ServiceSessionContext[], date: string, preferredId?: number, preferredType?: string) {
  const choices = items.filter((item) => item.serviceDate === date && (item.serviceType === "FIRST_SERVICE" || item.serviceType === "SECOND_SERVICE")).sort((left, right) => (left.startsAt || "").localeCompare(right.startsAt || ""));
  if (!choices.length) return null;
  const byId = choices.find((item) => item.id === preferredId);
  if (byId) return byId;
  return choices.find((item) => item.serviceType === preferredType) || choices[0];
}

export function SundayContextProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ServiceSessionContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    const session = readTeacherSession();
    if (!session) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError("");
    // Clear the previous tab's service while the shared context resolves so
    // service-sensitive pages cannot briefly render stale data after refresh.
    clearActiveService();
    fetch(`${apiBase}/api/v1/service-sessions`, { headers: authHeaders(session), cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load the Sunday service context.");
        return Array.isArray(result.data)
          ? result.data.map((item: ServiceSessionContext & { id: number | string; campusId?: number | string; isOpen?: boolean | number | string }) => ({
            ...item,
            id: Number(item.id),
            campusId: item.campusId == null ? undefined : Number(item.campusId),
            isOpen: item.isOpen == null ? undefined : item.isOpen === true || String(item.isOpen) === "1",
          }))
          : [];
      })
      .then((nextItems) => {
        if (cancelled) return;
        const saved = loadSaved();
        const query = new URLSearchParams(window.location.search);
        const queryId = Number(query.get("serviceSessionId")) || undefined;
        const queryDate = query.get("date") || undefined;
        const requested = nextItems.find((item) => item.id === queryId);
        const savedService = nextItems.find((item) => item.id === saved.selectedServiceSessionId);
        const today = currentLagosDate();
        const fallbackDate = requested?.serviceDate || queryDate || savedService?.serviceDate || saved.selectedSundayDate || (new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(new Date()) === "Sun" ? today : mostRecentSunday(today));
        const [year, month] = monthKey(fallbackDate).split("-").map(Number);
        const options = sundayOptions(year, month);
        const date = options.some((option) => option.date === fallbackDate) ? fallbackDate : options[0]?.date || fallbackDate;
        const service = pickService(nextItems, date, requested?.id || savedService?.id, savedService?.serviceType);
        setItems(nextItems); setSelectedDate(date); setSelectedServiceId(service?.id || null); setLoading(false);
      })
      .catch((reason) => { if (!cancelled) { setLoading(false); setError(reason instanceof Error ? reason.message : "We could not load the Sunday service context."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const selectedService = useMemo(() => items.find((item) => item.id === selectedServiceId) || null, [items, selectedServiceId]);
  const selectedYear = selectedDate ? Number(selectedDate.slice(0, 4)) : null;
  const selectedMonth = selectedDate ? Number(selectedDate.slice(5, 7)) : null;
  const sundays = selectedYear && selectedMonth ? sundayOptions(selectedYear, selectedMonth) : [];
  const services = useMemo(() => items.filter((item) => item.serviceDate === selectedDate && (item.serviceType === "FIRST_SERVICE" || item.serviceType === "SECOND_SERVICE")).sort((left, right) => (left.startsAt || "").localeCompare(right.startsAt || "")), [items, selectedDate]);
  const months = useMemo(() => monthOptions(items, selectedDate), [items, selectedDate]);

  const publish = useCallback((date: string, service: ServiceSessionContext | null) => {
    setSelectedDate(date); setSelectedServiceId(service?.id || null);
    const saved = { selectedSundayDate: date, selectedServiceSessionId: service?.id || undefined };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const params = new URLSearchParams(window.location.search); params.set("date", date);
    if (service?.id) params.set("serviceSessionId", String(service.id)); else params.delete("serviceSessionId");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    if (service) {
      const active: ActiveService = { id: service.id, label: serviceDisplayLabel(service), serviceType: service.serviceType, serviceDate: service.serviceDate };
      setActiveService(active);
    } else clearActiveService();
  }, []);

  const selectMonth = useCallback((key: string) => {
    const [year, month] = key.split("-").map(Number);
    const options = sundayOptions(year, month);
    const preferred = options.find((option) => items.some((item) => item.serviceDate === option.date)) || options[0];
    if (!preferred) return;
    const currentType = selectedService?.serviceType;
    publish(preferred.date, pickService(items, preferred.date, undefined, currentType));
  }, [items, publish, selectedService?.serviceType]);
  const selectSunday = useCallback((date: string) => publish(date, pickService(items, date, undefined, selectedService?.serviceType)), [items, publish, selectedService?.serviceType]);
  const selectService = useCallback((id: number) => { const service = items.find((item) => item.id === id && item.serviceDate === selectedDate) || null; if (service && selectedDate) publish(selectedDate, service); }, [items, publish, selectedDate]);

  useEffect(() => {
    if (loading || !selectedDate) return;
    const service = selectedService;
    if (service) {
      setActiveService({ id: service.id, label: serviceDisplayLabel(service), serviceType: service.serviceType, serviceDate: service.serviceDate });
    } else clearActiveService();
  }, [loading, selectedDate, selectedService]);

  return <Context.Provider value={{ loading, error, retry, selectedYear, selectedMonth, selectedSundayDate: selectedDate, selectedServiceSessionId: selectedServiceId, selectedService, months, sundays, services, selectMonth, selectSunday, selectService }}>{children}</Context.Provider>;
}

export function useSundayContext() {
  const context = useContext(Context);
  if (!context) throw new Error("useSundayContext must be used inside SundayContextProvider");
  return context;
}
