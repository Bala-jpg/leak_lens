import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
export const ActiveLeakBanner:React.FC=()=>{
  const {valveState,isOnline,resolveLeak}=useTelemetry();
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const resolve=async()=>{setSaving(true);try{await resolveLeak();setError('');}catch{setError('Inspect and rearm the device, then wait for fresh normal telemetry before resolving.');}finally{setSaving(false);}};
  return <section className="bg-red-50 border border-red-600 rounded-xl p-5 mb-4 text-red-900">
    <h2 className="font-bold">Leak incident requires attention</h2>
    <p className="text-sm">{!isOnline?'Device telemetry is stale. Check the hardware.':valveState==='CLOSED'?'Hardware reports the valve output closed. Verify physical isolation.':'Valve output is not reported closed.'}</p>
    <p className="text-xs mt-2">After repairing the leak, rearm locally using the documented procedure. Then mark this incident resolved.</p>
    <button type="button" disabled={saving} onClick={resolve} className="mt-3 px-4 py-2 bg-red-600 text-white rounded">{saving?'Checking...':'Mark Leak as Fixed'}</button>
    {error && <p role="alert" className="text-xs mt-2">{error}</p>}
  </section>;
};
