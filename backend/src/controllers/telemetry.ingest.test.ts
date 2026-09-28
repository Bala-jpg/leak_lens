import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import app from '../app';
import pool from '../config/db';
import {initSocketIO} from '../socket';

test('hardware telemetry lifecycle, replay, ownership, freshness and resolution',{skip:process.env.DATABASE_TESTS!=='1'},async()=>{
  const server=http.createServer(app);const io=initSocketIO(server);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
  let userId:string|undefined;
  const call=async(path:string,body?:unknown,token?:string,method='POST')=>{
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,sampleAck:response.headers.get('x-accepted-sample'),eventAck:response.headers.get('x-accepted-event'),body:await response.json() as any};
  };
  try{
    const auth=await call('/auth/register',{name:'Ingest test',email:`${randomUUID()}@example.invalid`,password:randomUUID()});
    assert.equal(auth.status,201);userId=auth.body.data.user.id;const token=auth.body.data.accessToken;
    const registered=await call('/devices',{name:'Fixture',location:'Test'},token);const deviceId=registered.body.data.device.id;const key=registered.body.data.rawDeviceKey;
    const event={id:randomUUID(),inletFlowLpm:8,outletFlowLpm:5,lossL:0.2,cutoffDelayMs:3000};
    const payload={sampleId:'normal',inletFlowLpm:8,outletFlowLpm:5,inletTotalVolumeL:1,outletTotalVolumeL:1,valveState:'OPEN',leakDetected:false};
    const ingest=(changes:Record<string,unknown>={})=>call('/telemetry/ingest',{...payload,...changes},key);
    assert.equal((await ingest()).status,200);
    assert.equal((await pool.query('SELECT * FROM leak_events WHERE device_id=$1',[deviceId])).rowCount,0,'imbalance alone must not confirm a leak');
    await ingest({sampleId:'active',leakDetected:true,event});
    let incident=(await pool.query('SELECT * FROM leak_events WHERE device_id=$1',[deviceId])).rows[0];
    assert.equal(incident.status,'ACTIVE');assert.equal(incident.cutoff_at,null);
    const cutoff={sampleId:'closed',leakDetected:true,event,valveState:'CLOSED',inletFlowLpm:0,outletFlowLpm:0};
    await Promise.all([ingest(cutoff),ingest(cutoff)]);
    incident=(await pool.query('SELECT * FROM leak_events WHERE device_id=$1',[deviceId])).rows[0];
    assert.equal(incident.status,'CUTOFF');assert.equal(Number(incident.cutoff_latency_ms),3000);assert.equal(Number(incident.water_wasted_l),0.2);
    assert.equal((await pool.query('SELECT * FROM sensor_readings WHERE device_id=$1',[deviceId])).rowCount,3);
    assert.equal((await pool.query('SELECT * FROM notifications WHERE device_id=$1',[deviceId])).rowCount,2);
    assert.equal((await call(`/leaks/${incident.id}/resolve`,{},token,'PATCH')).status,409);
    assert.equal((await call(`/devices/${deviceId}/valve`,{state:'OPEN'},token)).status,409);
    await ingest({sampleId:'delayed',recordedAt:new Date(Date.now()-60000).toISOString()});
    assert.equal((await pool.query('SELECT valve_state FROM devices WHERE id=$1',[deviceId])).rows[0].valve_state,'CLOSED');
    await ingest({sampleId:'rearmed',inletFlowLpm:0,outletFlowLpm:0});
    assert.equal((await call(`/leaks/${incident.id}/resolve`,{},token,'PATCH')).status,200);
    await ingest({...cutoff,sampleId:'old-event',recordedAt:new Date(Date.now()-60000).toISOString()});
    assert.equal((await pool.query('SELECT * FROM leak_events WHERE device_id=$1',[deviceId])).rowCount,1);
    assert.equal((await call('/telemetry/ingest',payload,'invalid')).status,401);
    assert.equal((await ingest({sampleId:'invalid',inletFlowLpm:-1})).status,400);
    const timedEvent={id:randomUUID(),originBootId:'boot-A',detectedUptimeMs:6000,cutoffUptimeMs:9000,cutoffDelayMs:3000,inletFlowLpm:8,outletFlowLpm:5,lossL:0.2};
    const timed={sampleId:'timed',bootId:'boot-A',sampledUptimeMs:10000,ageMs:10000,leakDetected:true,event:timedEvent,valveState:'CLOSED'};
    const first=await ingest(timed);
    assert.equal(first.status,200);assert.equal(first.sampleAck,'timed');assert.equal(first.eventAck,timedEvent.id);assert.equal(first.body.sampleId,'timed');assert.equal(first.body.acceptedEventId,timedEvent.id);
    const stored=(await pool.query("SELECT * FROM sensor_readings WHERE device_id=$1 AND sample_id='timed'",[deviceId])).rows[0];
    assert.equal(stored.boot_id,'boot-A');assert.equal(Number(stored.sampled_uptime_ms),10000);
    assert.equal(stored.received_at.getTime()-stored.recorded_at.getTime(),10000);
    const timedIncident=(await pool.query('SELECT * FROM leak_events WHERE device_id=$1 AND hardware_event_id=$2',[deviceId,timedEvent.id])).rows[0];
    assert.equal(timedIncident.event_time_basis,'UPTIME_ESTIMATE');
    assert.equal(timedIncident.detection_occurred_at.getTime(),stored.recorded_at.getTime()-4000);
    assert.equal(timedIncident.cutoff_occurred_at.getTime(),stored.recorded_at.getTime()-1000);
    assert.equal(timedIncident.detected_at.getTime(),stored.received_at.getTime());
    const retry=await ingest({...timed,ageMs:11000});assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);
    assert.equal(retry.body.acceptedEventId,timedEvent.id);assert.equal(retry.sampleAck,'timed');assert.equal(retry.eventAck,timedEvent.id);
    assert.equal((await ingest({...timed,inletFlowLpm:9})).status,409);
    // An incident first seen after reboot must not receive invented occurrence timestamps.
    const rebootEvent={...timedEvent,id:randomUUID()};
    assert.equal((await ingest({...timed,sampleId:'reboot',bootId:'boot-B',sampledUptimeMs:100,ageMs:0,event:rebootEvent,inletTotalVolumeL:0.01,outletTotalVolumeL:0})).status,200);
    const rebootIncident=(await pool.query('SELECT * FROM leak_events WHERE hardware_event_id=$1',[rebootEvent.id])).rows[0];
    assert.equal(rebootIncident.event_time_basis,'UNKNOWN');assert.equal(rebootIncident.detection_occurred_at,null);
    assert.equal(rebootIncident.cutoff_occurred_at,null);
    assert.equal((await ingest({sampleId:'reverse',inletFlowLpm:1,outletFlowLpm:2})).body.reading.flowDifferenceLpm,-1);
    for(const changes of [{sampleId:'bad',inletTotalVolumeL:1e10},{sampleId:'bad',event:timedEvent},{sampleId:'bad',bootId:'partial'}]) assert.equal((await ingest(changes)).status,400);
    assert.equal((await call('/telemetry/device/not-a-uuid',undefined,token,'GET')).status,400);
    assert.equal((await call('/devices/not-a-uuid',undefined,token,'GET')).status,400);
    assert.equal((await call('/leaks?deviceId=not-a-uuid',undefined,token,'GET')).status,400);
    const history=await call(`/telemetry/device/${deviceId}?range=5m`,undefined,token,'GET');assert.equal(history.status,200);assert.ok(history.body.data.points.length);
  }finally{
    if(userId)await pool.query('DELETE FROM users WHERE id=$1',[userId]);
    await new Promise<void>(resolve=>io.close(()=>resolve()));await pool.end();
  }
});
