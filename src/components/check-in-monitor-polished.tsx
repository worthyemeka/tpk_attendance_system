"use client";

import { CheckInMonitor } from "@/components/check-in-monitor";

export function CheckInMonitorPolished() {
  return <>
    <CheckInMonitor />
    <style jsx global>{`
      .followup-submit{display:flex;align-items:flex-end;gap:10px;margin-top:2px}.followup-submit label{display:grid;gap:6px;color:#687184;font-size:10px;font-weight:800;letter-spacing:.2px}.followup-submit label select{height:38px;min-width:158px;appearance:none;border:1px solid #d9d2c8;border-radius:8px;background:#fffdfa;padding:0 30px 0 11px;color:#1d1e22;font:700 11px var(--font-body);outline:0;cursor:pointer}.followup-submit .solid-button{height:38px!important;border-color:#168b55!important;background:#168b55!important;box-shadow:0 4px 10px #168b5526}.followup-submit .solid-button:hover{background:#0d7545!important;border-color:#0d7545!important}.followup-submit .solid-button:disabled{background:#b8cbbf!important;border-color:#b8cbbf!important;box-shadow:none;cursor:not-allowed}.followup-submit .solid-button>svg{display:block;width:16px;height:16px;flex:none}.whatsapp-icon-slot{width:16px;height:16px;display:grid;place-items:center;flex:none}.whatsapp-icon-slot svg{width:16px;height:16px}@media(max-width:590px){.followup-submit{display:grid;align-items:stretch}.followup-submit label select,.followup-submit .solid-button{width:100%}}
    `}</style>
  </>;
}
