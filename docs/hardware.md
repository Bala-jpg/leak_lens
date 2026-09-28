# LeakLens bench wiring and acceptance

## Pin map

| ESP32 GPIO | Connection |
| --- | --- |
| 25 | Inlet flow sensor pulse through a 5 V to 3.3 V level shifter |
| 26 | Outlet flow sensor pulse through a 5 V to 3.3 V level shifter |
| 5 | Relay input; LOW = valve open, HIGH = cutoff in the supplied prototype |
| 12 | Buzzer driver input |

The LCD uses I2C address `0x27` and the `LiquidCrystal_I2C` Arduino library. Use a separate supply rated for the valve coil and a relay or MOSFET driver with a flyback diode. Tie grounds together where the driver design requires it. Never connect a 5 V pulse or a 12 V coil directly to ESP32 GPIO. Confirm relay polarity on the actual assembled board before energizing the valve. GPIO 12 is an ESP32 boot strap pin; verify the buzzer driver does not pull it high during boot.

## Bill of materials

- ESP32 development board, USB supply, two calibrated flow sensors, normally closed 12 V solenoid valve.
- Suitable valve driver, flyback diode, buzzer and driver, 12 V supply, level shifters or resistor dividers, plumbing fittings.

## Bench record

1. Copy `firmware/LeakLens/secrets.example.h` to `secrets.h` and set Wi-Fi, device key, and a LAN telemetry URL.
2. The supplied prototype uses calibration factor 6, equivalent to 360 pulses/L. Measure actual water volume through each sensor at 1 L and 5 L, then adjust each `PULSES_PER_LITRE` constant independently.
3. Verify balanced flow stays open. Introduce a controlled differential above 0.5 L/min for more than 3 seconds. Record onset and physical closure times.
4. Disconnect Wi-Fi and repeat. Local cutoff and buzzer must still work.
5. Remove power and verify the chosen normally closed valve closes mechanically. Restore power and inspect startup state.
6. The board starts with the output CLOSED, including after reset. Inspect and repair first. Once the retained leak event has reached the backend, send REARM with newline through Serial Monitor at 115200 baud; wait for normal telemetry before resolving the incident in the dashboard. See hardware-ready.md.

Physical calibration, power failure behavior, and cutoff timing require an assembled bench and have not been measured in this repository.
