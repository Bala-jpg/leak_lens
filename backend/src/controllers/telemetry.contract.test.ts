import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ingestSchema} from './telemetry.controller';

const sample = {bootId:'boot-A',sampleId:'boot-A-1',sampledUptimeMs:10000,inletFlowLpm:6,outletFlowLpm:5,
  inletTotalVolumeL:1,outletTotalVolumeL:0.9,valveState:'CLOSED',leakDetected:true,
  event:{id:'event-1',originBootId:'boot-A',detectedUptimeMs:6000,cutoffUptimeMs:9000,cutoffDelayMs:3000,inletFlowLpm:6,outletFlowLpm:5,lossL:0.05}};
test('telemetry contract validates numeric limits, identifiers and event consistency',()=>{
  assert.ok(ingestSchema.safeParse(sample).success);
  for(const change of [{bootId:'bad space'},{sampleId:''},{sampledUptimeMs:undefined},{inletFlowLpm:Infinity},
    {outletFlowLpm:-1},{inletTotalVolumeL:1e10},{leakDetected:false},{valveState:'OPEN'},
    {event:{...sample.event,cutoffUptimeMs:5000}}, {event:{...sample.event,cutoffDelayMs:2}},
    {event:{...sample.event,cutoffUptimeMs:12000,cutoffDelayMs:6000}}]) {
    assert.equal(ingestSchema.safeParse({...sample,...change}).success,false,JSON.stringify(change));
  }
  // Previous-boot monotonic clocks cannot be compared to this boot's uptime.
  assert.ok(ingestSchema.safeParse({...sample,bootId:'boot-B',sampledUptimeMs:100}).success);
  const {bootId,sampledUptimeMs,event,...legacy}=sample;
  assert.ok(ingestSchema.safeParse(legacy).success);
});
