"use client";

import { useCallback, useEffect, useState } from "react";
import { apiBase, authHeaders, readTeacherSession, type TeacherSession } from "@/lib/session";

type ChannelState = { enabled: boolean; available: boolean; consent?: boolean; status?: string };
type Preferences = {
  channels: { whatsapp: ChannelState; push: ChannelState; email: ChannelState };
  categories: Record<string, { whatsapp: boolean; push: boolean; email: boolean }>;
  categoryNames: Record<string, string>;
};
type Delivery = { id: number; channel: string; status: string; failureReason: string | null; createdAt: string; type: string; importance: string; title: string; staffName: string | null; providerMessageId: string | null };
const defaults: Preferences = { channels: { whatsapp: { enabled: false, available: false }, push: { enabled: false, available: false }, email: { enabled: false, available: false } }, categories: {}, categoryNames: {} };

export function NotificationSettings() {
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [data, setData] = useState(defaults);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isSuper = session?.accessLevel === "TPK_SUPER_ADMIN";

  const load = useCallback(async (current: TeacherSession) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/me/notification-preferences`, { headers: authHeaders(current), cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Notification settings are unavailable.");
      setData(result.data as Preferences);
      if (current.accessLevel === "TPK_SUPER_ADMIN") {
        const deliveriesResponse = await fetch(`${apiBase}/api/v1/admin/notification-deliveries`, { headers: authHeaders(current), cache: "no-store" });
        const deliveryResult = await deliveriesResponse.json();
        if (deliveriesResponse.ok && deliveryResult.success) setDeliveries(deliveryResult.data || []);
      }
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Notification settings are unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const current = readTeacherSession(); if (!current) { setLoading(false); return; } setSession(current); void load(current); }, [load]);

  const save = async (patch: Record<string, unknown>) => {
    if (!session) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/me/notification-preferences`, { method: "PATCH", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Your notification preferences could not be saved.");
      setData(result.data as Preferences); setMessage("Your notification settings have been saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your notification preferences could not be saved."); }
    finally { setSaving(false); }
  };

  const toggleChannel = (channel: "whatsapp" | "push" | "email", enabled: boolean) => {
    setData(current => ({ ...current, channels: { ...current.channels, [channel]: { ...current.channels[channel], enabled } } }));
  };
  const toggleCategory = (category: string, channel: "whatsapp" | "push" | "email", enabled: boolean) => {
    setData(current => { const existing = current.categories[category] ?? { whatsapp: false, push: false, email: false }; return { ...current, categories: { ...current.categories, [category]: { ...existing, [channel]: enabled } } }; });
  };
  const saveAll = () => save({ whatsappEnabled: data.channels.whatsapp.enabled, pushEnabled: data.channels.push.enabled, emailEnabled: data.channels.email.enabled, whatsappConsent: data.channels.whatsapp.consent, categories: data.categories });

  const retry = async (id: number) => {
    if (!session) return;
    try { const response = await fetch(`${apiBase}/api/v1/admin/notification-deliveries/${id}/retry`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" } }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error?.message || "This delivery cannot be retried."); await load(session); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This delivery cannot be retried."); }
  };

  return <section className="notification-settings">
    <header><p className="eyebrow">Your delivery choices</p><h2>Notifications</h2><p>Important duties stay in your in-app notifications. Choose which optional channels you want TPK to use.</p></header>
    {loading ? <p>Loading your notification preferences…</p> : <>
      <div className="notification-channel-grid">
        {(["whatsapp", "push", "email"] as const).map(channel => <label className="notification-channel" key={channel}>
          <input type="checkbox" checked={data.channels[channel].enabled} onChange={event => toggleChannel(channel, event.target.checked)} />
          <span><b>{channel === "whatsapp" ? "WhatsApp notifications" : channel === "push" ? "Push notifications" : "Email notifications"}</b><small>{data.channels[channel].status || (data.channels[channel].available ? "Available" : "Not configured by TPK yet")}</small></span>
        </label>)}
      </div>
      <label className="notification-consent"><input type="checkbox" checked={Boolean(data.channels.whatsapp.consent)} onChange={event => setData(current => ({ ...current, channels: { ...current.channels, whatsapp: { ...current.channels.whatsapp, consent: event.target.checked } } }))} /><span>I agree to receive ministry-related WhatsApp messages from TribePetra Kids. I can withdraw consent at any time.</span></label>
      <div className="notification-preference-table" role="table" aria-label="Notification categories">
        <div className="notification-pref-row notification-pref-head" role="row"><b>Category</b><b>WhatsApp</b><b>Push</b><b>Email</b></div>
        {Object.entries(data.categoryNames).map(([key, label]) => <div className="notification-pref-row" role="row" key={key}><span>{label}</span>{(["whatsapp", "push", "email"] as const).map(channel => <label key={channel} aria-label={`${label}: ${channel}`}><input type="checkbox" checked={Boolean(data.categories[key]?.[channel])} onChange={event => toggleCategory(key, channel, event.target.checked)} disabled={channel === "whatsapp" && !data.channels.whatsapp.consent} /></label>)}</div>)}
      </div>
      <p className="notification-essential-note">Duty assignments, duty changes, roster publication and urgent notices always remain in-app. TPK controls whether essential notices may also use WhatsApp.</p>
      {error && <p className="notification-settings-error" role="alert">{error}</p>}{message && <p className="notification-settings-message" role="status">{message}</p>}
      <button className="notification-settings-save" type="button" disabled={saving} onClick={saveAll}>{saving ? "Saving…" : "Save notification settings"}</button>
    </>}
    {isSuper && <section className="notification-delivery-admin"><div><p className="eyebrow">Super Admin</p><h3>Recent notification deliveries</h3><p>Provider response IDs and credentials stay private. Failures show a short reason code.</p></div><div className="notification-delivery-list">{deliveries.slice(0, 50).map(item => <article key={item.id}><span><b>{item.title}</b><small>{item.staffName || "Former staff"} · {item.channel} · {item.status}{item.failureReason ? ` · ${item.failureReason}` : ""}</small></span>{item.status === "FAILED" && item.importance === "ESSENTIAL" && <button type="button" onClick={() => void retry(item.id)}>Retry</button>}</article>)}{!deliveries.length && <p>No delivery records yet.</p>}</div></section>}
    <style jsx>{`.notification-settings{max-width:980px;margin-top:18px;padding:22px;border:1px solid var(--line,#e5ded5);border-radius:16px;background:var(--card,#fffdfa);color:var(--ink,#243754)}.notification-settings header{margin-bottom:18px}.notification-settings h2,.notification-settings h3{margin:0;font:800 21px var(--font-body)}.notification-settings header>p:last-child,.notification-delivery-admin>div>p:last-child{max-width:680px;color:var(--muted,#71819a);font-size:13px;line-height:1.5}.notification-channel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.notification-channel,.notification-consent{display:flex;align-items:flex-start;gap:10px;padding:14px;border:1px solid var(--line,#e5ded5);border-radius:11px;background:var(--surface,#fff);cursor:pointer}.notification-channel input,.notification-consent input,.notification-pref-row input{accent-color:var(--orange,#ed5733)}.notification-channel b,.notification-channel small{display:block}.notification-channel small{margin-top:5px;color:var(--muted,#71819a);font-size:11px;line-height:1.45}.notification-consent{margin-top:12px;color:var(--ink,#31435e);font-size:12px;line-height:1.5}.notification-preference-table{margin-top:18px;overflow-x:auto;border:1px solid var(--line,#e5ded5);border-radius:11px}.notification-pref-row{display:grid;grid-template-columns:minmax(190px,1fr) repeat(3,90px);align-items:center;gap:10px;min-height:47px;padding:0 14px;border-bottom:1px solid var(--line,#eee8df);font-size:12px}.notification-pref-row:last-child{border-bottom:0}.notification-pref-row>label{text-align:center}.notification-pref-head{background:var(--surface,#faf7f2);font-size:11px;color:var(--muted,#71819a)}.notification-essential-note{color:var(--muted,#71819a);font-size:11px;line-height:1.5}.notification-settings-save,.notification-delivery-list button{min-height:40px;padding:0 14px;border:0;border-radius:9px;background:var(--orange,#ed5733);color:#fff;font-weight:800;cursor:pointer}.notification-settings-save:disabled{opacity:.55;cursor:wait}.notification-settings-error,.notification-settings-message{font-size:12px}.notification-settings-error{color:#bb3d27}.notification-settings-message{color:#087757}.notification-delivery-admin{margin-top:28px;padding-top:20px;border-top:1px solid var(--line,#e5ded5)}.notification-delivery-admin h3{font-size:17px}.notification-delivery-list{display:grid;gap:7px;max-height:420px;overflow:auto}.notification-delivery-list article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:1px solid var(--line,#e5ded5);border-radius:9px}.notification-delivery-list article b,.notification-delivery-list article small{display:block}.notification-delivery-list article small{margin-top:4px;color:var(--muted,#71819a);font-size:10px}@media(max-width:700px){.notification-channel-grid{grid-template-columns:1fr}.notification-pref-row{grid-template-columns:minmax(150px,1fr) repeat(3,64px);gap:5px;padding:0 8px}.notification-settings{padding:16px}}`}</style>
  </section>;
}
