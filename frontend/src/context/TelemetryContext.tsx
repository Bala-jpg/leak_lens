import React,{createContext,useContext,useState,useEffect,useCallback,useRef} from 'react';
import type {FlowDataPoint,LeakEvent,SensorReading,ValveState} from '../types';
import {leakApi,telemetryApi,normalizeReading} from '../api';
import {socket} from '../api/socket';
import {useDevices} from './DeviceContext';
import {useAuth} from './AuthContext';
interface TelemetryContextType {
  inletFlow:number;outletFlow:number;flowDifference:number;flowHistory:FlowDataPoint[];
  valveState:ValveState;isLeakActive:boolean;activeLeak:LeakEvent|null;isOnline:boolean;hasReading:boolean;
  cutoffLatency:number|null;recentIncidents:LeakEvent[];waterWasted30d:number;waterSaved30d:number;
  resolveLeak:(id?:string)=>Promise<void>;refreshTelemetry:()=>void;lastSyncedAgo:number;
}
const TelemetryContext=createContext<TelemetryContextType|undefined>(undefined);
const merge=(readings:SensorReading[])=>[...new Map(readings.filter(r=>Number.isFinite(Date.parse(r.recordedAt))).map(r=>[r.id??r.recordedAt,r])).values()].sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt)).slice(-200);
export const TelemetryProvider:React.FC<{children:React.ReactNode}>=({children})=>{
  const {selectedDevice}=useDevices();const {isAuthenticated}=useAuth();
  const deviceId=selectedDevice?.id;
  const currentDevice=useRef(deviceId);currentDevice.current=deviceId;
  const [readings,setReadings]=useState<SensorReading[]>([]);
  const [events,setEvents]=useState<LeakEvent[]>([]);
  const [now,setNow]=useState(Date.now());
  const request=useRef(0);
  const refreshTelemetry=useCallback(()=>{
    if(!deviceId || !isAuthenticated)return;
    const version=++request.current;
    Promise.all([telemetryApi.getHistory(deviceId,200),leakApi.getEvents(deviceId)]).then(([history,incidents])=>{
      if(currentDevice.current!==deviceId || version!==request.current)return;
      setReadings(old=>merge([...history,...old.filter(r=>r.deviceId===deviceId)]));setEvents(incidents);
      if(!socket.connected)socket.connect();
    }).catch(console.error);
  },[deviceId,isAuthenticated]);
  useEffect(()=>{
    setReadings([]);setEvents([]);refreshTelemetry();
    const timer=setInterval(refreshTelemetry,10000);
    const requestCounter=request;
    return()=>{clearInterval(timer);++requestCounter.current;};
  },[refreshTelemetry]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(!isAuthenticated)return;
    const subscribe=()=>{if(deviceId)socket.emit('device:subscribe',deviceId);refreshTelemetry();};
    const onReading=(data:{deviceId:string;reading:SensorReading})=>{
      if(data.deviceId!==deviceId)return;
      setReadings(old=>merge([...old.filter(r=>r.deviceId===deviceId),normalizeReading(data.reading)]));
    };
    const onLeak=(data:{deviceId:string})=>{if(data.deviceId===deviceId)refreshTelemetry();};
    socket.on('connect',subscribe);socket.on('telemetry_update',onReading);socket.on('leak_alert',onLeak);
    if(socket.connected)subscribe();else socket.connect();
    return()=>{if(deviceId)socket.emit('device:unsubscribe',deviceId);socket.off('connect',subscribe);socket.off('telemetry_update',onReading);socket.off('leak_alert',onLeak);};
  },[deviceId,isAuthenticated,refreshTelemetry]);
  useEffect(()=>{if(!isAuthenticated){++request.current;socket.disconnect();setReadings([]);setEvents([]);}},[isAuthenticated]);
  const history=readings.filter(r=>r.deviceId===deviceId);
  const latest=history.at(-1);
  const recentIncidents=events.filter(e=>e.deviceId===deviceId);
  const activeLeak=recentIncidents.find(e=>e.status==='ACTIVE'||e.status==='CUTOFF')??null;
  const age=latest?Math.max(0,Math.floor((now-Date.parse(latest.recordedAt))/1000)):0;
  const isOnline=!!latest&&age<35;
  const period=recentIncidents.filter(e=>Date.parse(e.detectedAt)>=now-30*86400000);
  const resolveLeak=async(id?:string)=>{const target=id??activeLeak?.id;if(target){await leakApi.resolveEvent(target);refreshTelemetry();}};
  return <TelemetryContext.Provider value={{
    inletFlow:latest?.inletFlowLpm??0,outletFlow:latest?.outletFlowLpm??0,flowDifference:latest?.flowDifferenceLpm??0,
    flowHistory:history.map(r=>({time:new Date(r.recordedAt).toLocaleTimeString(),timestamp:Date.parse(r.recordedAt),inletFlow:r.inletFlowLpm,outletFlow:r.outletFlowLpm,difference:r.flowDifferenceLpm})),
    valveState:latest?.valveState??'UNKNOWN',hasReading:!!latest,isOnline,isLeakActive:!!activeLeak||!!latest?.leakDetected,activeLeak,
    cutoffLatency:activeLeak?.cutoffLatencySec??null,recentIncidents,
    waterWasted30d:period.reduce((s,e)=>s+e.waterWastedL,0),waterSaved30d:period.reduce((s,e)=>s+e.estimatedWaterSavedL,0),
    resolveLeak,refreshTelemetry,lastSyncedAgo:age,
  }}>{children}</TelemetryContext.Provider>;
};
export const useTelemetry=()=>{const context=useContext(TelemetryContext);if(!context)throw new Error('useTelemetry requires TelemetryProvider');return context;};
