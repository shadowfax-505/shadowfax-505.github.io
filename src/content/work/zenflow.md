---
title: ZenFlow
summary: A focus timer and screen-time tracker, built twice — a JavaFX desktop app that watches the active window on macOS, and an Android app that rates each app's foreground time.
kind: selected
order: 4
year: 2026
role: Both applications, end to end
stack: [Java, JavaFX, SQLite, Android, Room, Gradle]
statuses: [shipped]
metrics:
  - { value: '2', label: 'platforms, desktop and Android' }
  - { value: '25', label: 'Java source files in the desktop app, with DAO tests for session storage' }
links:
  - { label: Desktop repository, url: 'https://github.com/shadowfax-505/Zenflow' }
  - { label: Android repository, url: 'https://github.com/shadowfax-505/ZenFlow_Android' }
---
## The problem

A timer gets a focus session started. Keeping the habit takes reminders, a history of past sessions, and an honest picture of where screen time actually goes.

## Desktop

Java 24, JavaFX 21 and SQLite. Timer, session history, reminders, a dashboard, settings and an admin view. The interesting part is active-window tracking: on macOS the app polls the frontmost window through AppleScript, groups apps into categories with daily limits, and flags overuse.

## Android

Java, Room and the Usage Stats API. Focus sessions are stored locally, reminders are scheduled, and every app is rated *OK*, *cut back* or *seriously addicted* from its foreground time against thresholds the user can change. Usage access is requested explicitly on first launch.

## What I learned

The same product idea meets very different operating-system rules. macOS lets you ask which window is in front; Android gives you aggregated usage only after the user grants a special permission. The data model had to fit both.
