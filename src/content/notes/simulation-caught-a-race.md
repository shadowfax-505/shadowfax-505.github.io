---
title: The simulator found the bug I would have blamed on Wi-Fi
date: 2026-10-24
summary: How running my recorder's production firmware through 18 fault scenarios in Wokwi exposed a race in the live preview, and what the fix was.
draft: false
---
My [AFO recorder](/work/afo-recorder/) has not been on a bench yet. Before I solder anything, I want to know what the firmware does when the hardware misbehaves, because those are the cases that are hardest to reproduce once a board is on the table.

## The setup

The simulation runs the real firmware, built with ESP-IDF 5.4.2, on Wokwi's ESP32-S3. The parts Wokwi does not have I wrote as custom chips in C, compiled to WebAssembly:

- an **AD7606** that answers CONVST with BUSY and serves samples over SPI,
- an **ICM-42688-P** with its FIFO, interrupt and timestamp counter,
- a small **fixture chip** that tells the simulated board which scenario below to run.

The SD card is replaced by a block device in PSRAM, but FatFS and the file system layer above it are the real ones. The live preview sends real UDP datagrams to a receiver inside the emulated chip. Every case keeps its logic-analyzer trace, and an assessor reads the output with the same converter and live decoder I use on the laptop.

## Eighteen ways to fail

Each scenario is a fault I expect to meet eventually:

- **ADC:** BUSY stuck high, BUSY that never rises, a trigger the ADC ignores.
- **Motion sensors:** FIFO overflow, a missing interrupt, the shank sensor unplugged.
- **Storage:** the card fails to mount, a write error, a full card, writes delayed by 50 ms, a 350 ms stall, a recording interrupted mid-file.
- **Power and USB:** low battery, USB plugged in while recording.
- **Wireless:** no one listening, lost packets.
- And the two baselines: a normal recording and a recording of filtered synthetic EMG.

## What failed

On firmware 1.11, ten of the eleven cases I had run passed. The one that failed was the missing-interrupt case, and not because of the interrupt.

The live-preview task checks once per loop whether a new session has started and, if so, sends that session's description. A record could be taken off the queue just after that check. When it was the first record of a new session, it went out before the description did. The laptop had never heard of the session, so it dropped the packet.

On a bench, this would have looked like an occasional missing first packet in the preview. I would have blamed the radio. The recording on the card was never affected; only the preview was, which is exactly why it would have been easy to wave away.

## The fix

In 1.12, the live task always announces a session before it sends any data from it. Then I ran the whole matrix again: all 18 cases pass.

The same run produced a timing audit: the fixture triggered the ADC at about 7,984 Hz against an 8 kHz target, the motion sensors ticked at 32/30 µs per count at 200 Hz, and the session description used 1,317 of its 1,400 bytes.

Two problems along the way were in my test fixture, not the firmware: its PSRAM budget and UDP buffer still assumed an older queue size. I fixed those in the fixture only. And the 350 ms stall case now expects a normal stop, because the 2.44-second queue absorbs a stall that long without losing data.

## What this does not prove

A simulator has no analog noise, no real card timing, no radio and no battery. The bench stages are written down with pass criteria, and until they are done everything above is simulation. What it does give me is a list of failures I no longer have to discover with a soldering iron in my hand.

The evidence for every case is in the [recorder's repository](https://github.com/shadowfax-505/afo-recorder).
