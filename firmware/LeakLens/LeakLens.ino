#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <esp_timer.h>
#include "config.h"

LiquidCrystal_I2C lcd(0x27,16,2);
Preferences preferences;
portMUX_TYPE pulseMux=portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t inletPulses=0,outletPulses=0;
// Only loop() owns measurement/control state. Network task receives copies.
// Keep the original layout so an existing retained incident can be migrated.
struct LegacyEvent { char id[48]; float inlet; float outlet; float loss; uint32_t delayMs; };
struct Event { char id[48]; float inlet; float outlet; float loss; uint32_t delayMs;
  char originBootId[24]; uint64_t detectedUptimeMs; uint64_t cutoffUptimeMs;
};
struct Sample { char id[64]; float inlet,outlet,inTotal,outTotal; bool closed,leak; Event event; int64_t sampledUs; };
QueueHandle_t telemetryQueue;
Event leakEvent={};
bool valveClosed=true,leakDetected=false;
char acknowledgedEventId[48]={}; // guarded by pulseMux across tasks
float inletTotalL=0,outletTotalL=0,inletLpm=0,outletLpm=0,candidateLoss=0;
uint32_t lastSample=0,lastTelemetry=0,imbalanceSince=0,sequence=0;
char bootId[24];
uint64_t candidateStartedMs=0;

void IRAM_ATTR inletPulse(){portENTER_CRITICAL_ISR(&pulseMux);++inletPulses;portEXIT_CRITICAL_ISR(&pulseMux);}
void IRAM_ATTR outletPulse(){portENTER_CRITICAL_ISR(&pulseMux);++outletPulses;portEXIT_CRITICAL_ISR(&pulseMux);}
void setValve(bool closed){valveClosed=closed;digitalWrite(VALVE_PIN,closed?(VALVE_OPEN_LEVEL==HIGH?LOW:HIGH):VALVE_OPEN_LEVEL);digitalWrite(BUZZER_PIN,leakDetected?HIGH:LOW);}
void enqueueTelemetry(){
  Sample s={};snprintf(s.id,sizeof(s.id),"%s-%lu",bootId,(unsigned long)++sequence);
  s.inlet=inletLpm;s.outlet=outletLpm;s.inTotal=inletTotalL;s.outTotal=outletTotalL;
  s.closed=valveClosed;s.leak=leakDetected;s.event=leakEvent;s.sampledUs=esp_timer_get_time();
  // Bounded latest-sample mailbox. Event is repeated until explicitly rearmed.
  xQueueOverwrite(telemetryQueue,&s);
}
void sampleFlow(uint32_t now){
  uint32_t elapsed=now-lastSample;if(elapsed<SAMPLE_MS)return;
  uint32_t inlet,outlet;portENTER_CRITICAL(&pulseMux);inlet=inletPulses;outlet=outletPulses;inletPulses=outletPulses=0;portEXIT_CRITICAL(&pulseMux);
  lastSample=now;float inL=inlet/INLET_PULSES_PER_LITRE,outL=outlet/OUTLET_PULSES_PER_LITRE;
  inletTotalL+=inL;outletTotalL+=outL;inletLpm=inL*60000.0f/elapsed;outletLpm=outL*60000.0f/elapsed;
  if(!valveClosed && inletLpm>0.3f && inletLpm-outletLpm>=LEAK_THRESHOLD_LPM){
    if(!imbalanceSince){imbalanceSince=now;candidateLoss=0;candidateStartedMs=esp_timer_get_time()/1000;}
    candidateLoss+=max(0.0f,inL-outL);
    if(now-imbalanceSince>=CONFIRM_MS){
      leakDetected=true;setValve(true);
      snprintf(leakEvent.id,sizeof(leakEvent.id),"%s-leak-%lu",bootId,(unsigned long)now);
      leakEvent.inlet=inletLpm;leakEvent.outlet=outletLpm;leakEvent.loss=candidateLoss;leakEvent.detectedUptimeMs=candidateStartedMs;leakEvent.cutoffUptimeMs=esp_timer_get_time()/1000;
      leakEvent.delayMs=leakEvent.cutoffUptimeMs-leakEvent.detectedUptimeMs;
      strlcpy(leakEvent.originBootId,bootId,sizeof(leakEvent.originBootId));
      // Persist after commanding closure. Boot never automatically reopens.
      preferences.putBytes("eventV2",&leakEvent,sizeof(leakEvent));
      portENTER_CRITICAL(&pulseMux);acknowledgedEventId[0]=0;portEXIT_CRITICAL(&pulseMux);
      enqueueTelemetry();Serial.println("LEAK: output CLOSED; event retained. Inspect before REARM.");
    }
  }else if(!valveClosed){imbalanceSince=0;candidateLoss=0;}
  Serial.printf("In %.2f L/min Out %.2f L/min Total %.3f / %.3f L Output %s\n",inletLpm,outletLpm,inletTotalL,outletTotalL,valveClosed?"CLOSED":"OPEN");
  lcd.setCursor(0,0);lcd.print("                ");lcd.setCursor(0,0);
  if(leakDetected)lcd.print("LEAK: CLOSED");else {lcd.print("In:");lcd.print(inletLpm,1);lcd.print(" L/min");}
  lcd.setCursor(0,1);lcd.print("                ");lcd.setCursor(0,1);
  if(valveClosed)lcd.print("Inspect + REARM");else {lcd.print("Out:");lcd.print(outletLpm,1);lcd.print(" L/min");}
}
void networkTask(void*){
  WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  uint32_t wifiAttempt=millis();Sample pending={};bool havePending=false;
  for(;;){
    Sample latest;if(xQueueReceive(telemetryQueue,&latest,pdMS_TO_TICKS(200))==pdTRUE){pending=latest;havePending=true;}
    if(WiFi.status()!=WL_CONNECTED){if(millis()-wifiAttempt>=10000){wifiAttempt=millis();WiFi.reconnect();Serial.println("Wi-Fi reconnecting");}continue;}
    if(!havePending)continue;
    HTTPClient http;http.setConnectTimeout(1500);http.setTimeout(1500);
    int code=-1;bool accepted=false;
    if(http.begin(TELEMETRY_URL)){
      const char* ackHeaders[]={"X-Accepted-Sample","X-Accepted-Event"};
      http.collectHeaders(ackHeaders,2);
      http.addHeader("Content-Type","application/json");http.addHeader("X-Device-Key",DEVICE_KEY);
      uint64_t ageMs=(esp_timer_get_time()-pending.sampledUs)/1000;
      String body="{\"bootId\":\""+String(bootId)+"\",\"sampledUptimeMs\":"+String((unsigned long long)(pending.sampledUs/1000))+",\"sampleId\":\""+String(pending.id)+"\",\"ageMs\":"+String((unsigned long)min(ageMs,(uint64_t)604800000))+
        ",\"inletFlowLpm\":"+String(pending.inlet,2)+",\"outletFlowLpm\":"+String(pending.outlet,2)+
        ",\"inletTotalVolumeL\":"+String(pending.inTotal,3)+",\"outletTotalVolumeL\":"+String(pending.outTotal,3)+
        ",\"valveState\":\""+(pending.closed?"CLOSED":"OPEN")+"\",\"leakDetected\":"+(pending.leak?"true":"false");
      if(pending.leak){
        body+=",\"event\":{\"id\":\""+String(pending.event.id)+"\",\"inletFlowLpm\":"+String(pending.event.inlet,2)+",\"outletFlowLpm\":"+String(pending.event.outlet,2)+",\"lossL\":"+String(pending.event.loss,3)+",\"cutoffDelayMs\":"+String(pending.event.delayMs);
        if(pending.event.originBootId[0]) body+=",\"originBootId\":\""+String(pending.event.originBootId)+"\",\"detectedUptimeMs\":"+String((unsigned long long)pending.event.detectedUptimeMs)+",\"cutoffUptimeMs\":"+String((unsigned long long)pending.event.cutoffUptimeMs);
        body+="}";
      }
      body+="}";code=http.POST(body);
      accepted=code>=200 && code<300 && http.header("X-Accepted-Sample")==String(pending.id)
        && (!pending.leak || http.header("X-Accepted-Event")==String(pending.event.id));
      http.end();
    }
    Serial.printf("Telemetry HTTP %d\n",code);
    if(accepted){
      if(pending.leak){portENTER_CRITICAL(&pulseMux);strlcpy(acknowledgedEventId,pending.event.id,sizeof(acknowledgedEventId));portEXIT_CRITICAL(&pulseMux);}
      havePending=false;
    }else vTaskDelay(pdMS_TO_TICKS(2000));
  }
}
void setup(){
  Serial.begin(115200);pinMode(VALVE_PIN,OUTPUT);pinMode(BUZZER_PIN,OUTPUT);setValve(true);
  preferences.begin("leaklens",false);
  if(preferences.getBytesLength("eventV2")==sizeof(leakEvent)){
    preferences.getBytes("eventV2",&leakEvent,sizeof(leakEvent));leakDetected=true;
  }else if(preferences.getBytesLength("event")==sizeof(LegacyEvent)){
    LegacyEvent old={};preferences.getBytes("event",&old,sizeof(old));
    memcpy(leakEvent.id,old.id,sizeof(old.id));leakEvent.inlet=old.inlet;leakEvent.outlet=old.outlet;
    leakEvent.loss=old.loss;leakEvent.delayMs=old.delayMs;leakDetected=true;
    // Legacy events have no occurrence clock. Preserve them without inventing one.
    preferences.putBytes("eventV2",&leakEvent,sizeof(leakEvent));
  }
  setValve(true);
  snprintf(bootId,sizeof(bootId),"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());
  pinMode(INLET_PIN,INPUT_PULLUP);pinMode(OUTLET_PIN,INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(INLET_PIN),inletPulse,FALLING);attachInterrupt(digitalPinToInterrupt(OUTLET_PIN),outletPulse,FALLING);
  lcd.init();lcd.backlight();lastSample=millis();
  telemetryQueue=xQueueCreate(1,sizeof(Sample));
  if(!telemetryQueue || xTaskCreate(networkTask,"telemetry",8192,nullptr,1,nullptr)!=pdPASS){Serial.println("Network task failed; output remains CLOSED");while(true)delay(1000);}
  enqueueTelemetry();Serial.println("Booted CLOSED. Inspect plumbing, then send REARM + newline at 115200 baud.");
}
void loop(){
  uint32_t now=millis();sampleFlow(now);
  // Nonblocking, bounded serial command; never accept a network rearm command.
  static char command[16];static size_t length=0;static bool overflow=false;
  while(Serial.available()){
    char c=Serial.read();if(c=='\n'){
      command[length]='\0';bool acknowledged;portENTER_CRITICAL(&pulseMux);acknowledged=strcmp(acknowledgedEventId,leakEvent.id)==0;portEXIT_CRITICAL(&pulseMux);
      if(!overflow && strcmp(command,"REARM")==0){
        if(leakDetected&&!acknowledged)Serial.println("REARM blocked: retained incident must reach backend first.");
        else{preferences.remove("eventV2");preferences.remove("event");leakDetected=false;leakEvent={};imbalanceSince=0;candidateLoss=0;setValve(false);enqueueTelemetry();Serial.println("Output OPEN after local REARM.");}
      }length=0;overflow=false;
    }else if(c!='\r'){if(length<sizeof(command)-1)command[length++]=c;else overflow=true;}
  }
  if(now-lastTelemetry>=TELEMETRY_MS){lastTelemetry=now;enqueueTelemetry();}
  delay(1);
}
