#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
const scenario=process.argv[2]||'nominal';
const key=process.env.DEVICE_KEY;
const url=process.env.TELEMETRY_URL||'http://localhost:5000/api/v1/telemetry/ingest';
if(!key||!['nominal','rupture','pinhole','dropout'].includes(scenario)){
  console.error('Set DEVICE_KEY and choose nominal, rupture, pinhole, or dropout');process.exit(1);
}
const session=randomUUID();const started=performance.now();let inletTotalVolumeL=0,outletTotalVolumeL=0;
let since=null,lossL=0,event=null,closed=false;
for(let sample=0;sample<25;sample++){
  const inletFlowLpm=closed?0:12;
  const difference=closed?0:scenario==='rupture'&&sample>=3?5:scenario==='pinhole'?0.15+sample*0.06:0;
  const outletFlowLpm=Math.max(0,inletFlowLpm-difference);
  inletTotalVolumeL+=inletFlowLpm/60;outletTotalVolumeL+=outletFlowLpm/60;
  if(!closed&&difference>=0.5){
    since??=Math.floor(performance.now()-started);lossL+=difference/60;
    const cutoffUptimeMs=Math.floor(performance.now()-started);
    if(cutoffUptimeMs-since>=3000){closed=true;event={id:session+'-leak',originBootId:session,detectedUptimeMs:since,cutoffUptimeMs,inletFlowLpm,outletFlowLpm,lossL,cutoffDelayMs:cutoffUptimeMs-since};}
  }else if(!closed){since=null;lossL=0;}
  // Simulate the firmware's local decision; never act on a server valve command.
  const payload={bootId:session,sampledUptimeMs:Math.floor(performance.now()-started),sampleId:session+'-'+sample,inletFlowLpm,outletFlowLpm,inletTotalVolumeL,outletTotalVolumeL,valveState:closed?'CLOSED':'OPEN',leakDetected:closed,...(event?{event}:{})};
  if(scenario==='dropout'&&sample>=4&&sample<=12)console.log('Network unavailable: routine sample dropped; local monitoring continues');
  else try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Device-Key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const ack=await response.json();
    if(ack.sampleId!==payload.sampleId || (event && ack.acceptedEventId!==event.id))throw new Error('Telemetry acknowledgement mismatch');
    console.log(`sample ${sample}: inlet=${inletFlowLpm} outlet=${outletFlowLpm} valve=${payload.valveState}, HTTP ${response.status}`);
  }catch(error){console.error(error.message);}
  await new Promise(resolve=>setTimeout(resolve,1000));
}
