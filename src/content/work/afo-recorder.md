---
title: AFO research recorder
summary: A wearable recorder for lower-limb research that samples two EMG channels at 8 kHz and two motion sensors at 200 Hz, and writes every sample to microSD with enough bookkeeping to prove nothing was lost.
kind: selected
order: 1
year: 2026
role: Circuit, PCB, firmware, host tools and verification
stack: [ESP32-S3, ESP-IDF, AD7606, ICM-42688-P, KiCad, Wokwi, ngspice, Python]
statuses: [simulated, tested, pending]
metrics:
  - { value: '6', label: 'board variants, two ADC families × two IMUs' }
  - { value: '18 / 18', label: 'fault-injection cases pass in Wokwi, firmware 1.12', status: simulated }
  - { value: '0 / 0', label: 'DRC / ERC errors on all four AD7606 boards', status: tested }
  - { value: 'Pending', label: 'bench measurements on real hardware', status: pending }
cover: { src: /assets/afo/board-render.webp, alt: 'Rendered 3D model of the AFO recorder PCB, 75 by 50 millimetres, with the ESP32-S3 module, AD7606 ADC, microSD socket and sensor connectors', width: 1582, height: 964, caption: 'The two-channel AD7606 board, rendered from its KiCad model. 75 × 50 mm.' }
figures:
  - { src: /assets/afo/board-top.webp, alt: 'Top view of the AFO recorder PCB showing component placement and routed copper', width: 1452, height: 992, caption: 'Top view of the same board.' }
  - { src: /assets/afo/assembly-drawing.webp, alt: 'KiCad assembly drawing of the AFO recorder with reference designators', width: 1600, height: 1066, caption: 'Assembly drawing exported from KiCad.' }
  - { src: /assets/afo-precision-viewer.webp, alt: 'Browser-based assembly viewer showing the breadboard build and staged instructions', width: 1600, height: 876, caption: 'The browser assembly guide I built for the bench stages.' }
links:
  - { label: Repository, url: 'https://github.com/shadowfax-505/afo-recorder' }
  - { label: Documentation site, url: 'https://shadowfax-505.github.io/afo-recorder/' }
---
## What it is for

An ankle-foot orthosis (AFO) study needs muscle activity and limb motion recorded together, on one clock, for long enough to see a walking session. Off-the-shelf boards either sample EMG too slowly or lose data silently when an SD card stalls. I wanted a recorder whose files can be checked afterwards: every record numbered, timestamped and covered by a CRC, so a gap or a corrupted block shows up instead of hiding in the plot.

## The design

Two surface-EMG front ends feed an AD7606 ADC, triggered at 8 kHz and read over SPI. An ICM-42688-P on the foot and another on the shank stream motion data at 200 Hz. An ESP32-S3 timestamps everything and writes versioned binary records to microSD through a PSRAM queue that can absorb 2.44 s of storage stalls. Wi-Fi gives a live preview, but the SD file always comes first.

There are six variants of the design, from a fixed two-channel board to expandable ones, built on either an AD7606 or an ADS131M04 and either IMU. Each has its own schematic, PCB, bill of materials, firmware build and assembly guide.

## How I checked it before building it

- **Datasheets, line by line.** I cross-checked the AD7606 (Rev. G) pinout, timing and decoupling, and every ICM-42688-P register the firmware touches against TDK's DS-000347. One result: the IMU's timestamp counts in 32/30 µs ticks, not 1 µs, so the firmware and the analysis tools now convert it correctly.
- **A supply-ramp fix that only the datasheet revealed.** The ADC's logic rail can come up before its analog rail, which the absolute-maximum ratings forbid. Following ADI's AN-1091, I added a GPIO-controlled standby line with a 100 kΩ pull-down and a BAT760 Schottky clamp. The firmware now waits 30 ms after wake-up before resetting the ADC. I re-routed all four AD7606 boards to fit it; DRC and ERC are clean.
- **Analog front end in ngspice.** The anti-alias filter was simulated across 16 resistor and capacitor tolerance corners. Its −3 dB point sits at about 660 Hz, and both channels match.
- **Whole-system simulation in Wokwi.** I wrote custom Wokwi chips for the ADC, the IMUs and a fault fixture. Then I ran the production firmware through 18 scenarios: a stuck BUSY line, a full card, a write error, an IMU FIFO overflow, lost Wi-Fi packets, a 350 ms SD stall, USB plugged in mid-recording. All 18 pass on firmware 1.12. The EMG rate, measured from the recorded timestamps, came out at 7,984 Hz against an 8 kHz target.
- **The simulation found a real bug.** In firmware 1.11 the live preview could send a new session's first data packet before that session's description, so the laptop dropped it. Version 1.12 always announces a session before sending its data, and the full matrix was rerun.

## What is still open

No physical board has been measured yet. Signal quality, noise, battery life and wearable safety need the bench stages, which are written up as checklists with pass criteria. Until those results exist, everything above is simulation, software testing and design review.
