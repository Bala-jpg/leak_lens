#pragma once

// Pinout and pulse calibration from the working Blynk prototype.
constexpr int INLET_PIN = 25;
constexpr int OUTLET_PIN = 26;
constexpr int VALVE_PIN = 5;
constexpr int BUZZER_PIN = 12;
constexpr int VALVE_OPEN_LEVEL = LOW;
// Prototype calibrationFactor = 6 pulses/second per L/min = 360 pulses/L.
constexpr float INLET_PULSES_PER_LITRE = 360.0f;
constexpr float OUTLET_PULSES_PER_LITRE = 360.0f;
constexpr float LEAK_THRESHOLD_LPM = 0.5f;
constexpr unsigned long SAMPLE_MS = 1000;
constexpr unsigned long CONFIRM_MS = 3000;
constexpr unsigned long TELEMETRY_MS = 10000;

#ifdef LEAKLENS_COMPILE_CHECK
#include "secrets.example.h"
#else
#include "secrets.h"
#endif
