---
title: ZenFlow
summary: A focus timer and screen-time tracker for desktop and Android, with an AI assistant that runs on a local model and has to pass the app's own checks before you see its answer.
kind: selected
visual: zenflow
category: Desktop, mobile & local AI
order: 4
year: 2026
role: Both apps end to end — redesign, AI pipeline, evaluation
stack: [Java, JavaFX, SQLite, Android, Room, Ollama, Gradle]
statuses: [shipped, tested]
metrics:
  - { value: '69 / 70', label: 'AI answers usable on the first try across seven tasks, ten runs each', status: tested }
  - { value: '0 / 70', label: 'runs that needed the rule-based fallback; the retry saved the one miss', status: tested }
  - { value: '20% → 80%', label: 'quick-capture runs with every date exact, after date arithmetic moved into code', status: tested }
  - { value: '58 + 8', label: 'unit tests in the desktop and Android apps', status: tested }
cover: { src: /assets/zenflow/desktop-timer.webp, alt: 'ZenFlow desktop timer at 14:32 in a focus block, working on a reminder, with today''s progress of 75 of 150 minutes and an AI plan of three focus blocks', width: 1200, height: 750, caption: 'The desktop timer with an AI day plan. The app is real and the user is made up; the plan was written by qwen3:1.7b running on my laptop.' }
figures:
  - { src: /assets/zenflow/desktop-dashboard.webp, alt: 'ZenFlow dashboard with focus totals, an AI review of the day, an answer to the question how far am I from today''s goal, seven days of focus and top apps', width: 1200, height: 863, caption: 'Dashboard: the AI review and the answer to “How far am I from today''s goal?”, both checked against the numbers on the same screen.' }
  - { src: /assets/zenflow/desktop-quick-capture.webp, alt: 'Quick capture turning one sentence into three reminders dated tomorrow, Friday 30 October and today, waiting for confirmation', width: 1200, height: 750, caption: 'Quick capture: one sentence becomes three dated reminders. The model copies the “when” phrase; ZenFlow computes the date. Nothing is saved until you confirm.' }
  - { src: /assets/zenflow/android-timer.webp, alt: 'ZenFlow Android timer in a focus block with today''s progress', width: 540, height: 1200, caption: 'Android 2.0 on an Android 16 emulator, with the AI text generated live by qwen3:1.7b on the host computer. A focus block was running, so today''s minutes grew between captures.' }
  - { src: /assets/zenflow/android-plan.webp, alt: 'ZenFlow Android AI plan of three focus blocks with a first step', width: 540, height: 1200 }
  - { src: /assets/zenflow/android-review-and-ask.webp, alt: 'ZenFlow Android AI review of today and an answer saying the user is 70 minutes from the daily goal, retried once', width: 540, height: 1200 }
  - { src: /assets/zenflow/android-quick-capture.webp, alt: 'ZenFlow Android quick capture with three dated reminders to confirm', width: 540, height: 1200 }
links:
  - { label: Desktop repository, url: 'https://github.com/shadowfax-505/Zenflow' }
  - { label: Android repository, url: 'https://github.com/shadowfax-505/ZenFlow_Android' }
  - { label: Evaluation report, url: 'https://github.com/shadowfax-505/Zenflow/blob/main/docs/ai-eval.md' }
---
## The problem

A timer gets a focus block started. Keeping the habit takes a plan for the day, an honest look back, and a clear picture of where screen time goes. I wanted an assistant for that, with two conditions: a day's activity should not leave the computer, and the assistant should not make things up.

## What I built

**Desktop** (Java 25, JavaFX 25, SQLite). A focus timer that counts against a wall-clock deadline, so it never drifts; a daily goal and streaks; a dashboard with seven days of focus, screen time by hour, top apps and category limits; history with CSV export; reminders; and active-app tracking on macOS. Accounts use PBKDF2-hashed passwords, and the plain-text accounts and database from version 1 are migrated in place.

**Android** (Java, Material 3, Room). Rebuilt as one activity with five tabs. Room migrations replace the old behaviour of deleting the database whenever the schema changed, and the built-in administrator login, whose password was in the public source, is gone. App time comes from the Usage Stats API. Firebase analytics is optional and off until the user switches it on.

## The AI assistant

Seven features run on a local model through Ollama: a day plan from today's reminders, a daily review, a weekly report, *Ask ZenFlow*, quick capture of dated reminders, sorting unknown apps into categories, and a break idea. Android has five of them and talks to Ollama on a computer on the same network.

A 1.7-billion-parameter model answers in a few seconds on a laptop, but it gets things wrong in predictable ways. So the model never has the last word:

- **Schema.** Each task has a JSON schema that Ollama enforces, short literal rules, reasoning switched off and a 600-token cap.
- **Checks.** A plan may only contain your real reminders and must fit the blocks left today. Every number in a review must appear in your data. The model may not say you met a goal you did not, its minutes-left must add up, and "this afternoon" cannot come with a 10:00 start.
- **Code owns the facts.** Quick capture asks the model only to copy the "when" phrase ("Friday", "next Monday"); `DateResolver` turns it into a date. That one change took exact-date runs from 20% to 80%.
- **One retry, then rules.** A failed answer goes back to the model once, with the reason. If it fails again, or no model is running, ZenFlow writes the answer from rules and the card says so.
- **Privacy.** The desktop app refuses a server that is not on the same computer unless you allow it. Settings shows the exact text the model receives, and window titles never leave the machine.

## Measured

`./gradlew aiEval` runs every task ten times against the real model on a fixed demo day and writes the [evaluation report](https://github.com/shadowfax-505/Zenflow/blob/main/docs/ai-eval.md). Last run: qwen3:1.7b on a MacBook Air (Apple M1, 8 GB).

| Task | First answer usable | Saved by retry | Rules took over | Median | Accuracy |
| --- | --- | --- | --- | --- | --- |
| Plan | 10/10 | 0 | 0 | 4.1 s | 100%: only real tasks, fits the blocks left |
| Review | 10/10 | 0 | 0 | 3.0 s | — |
| Weekly report | 9/10 | 1 | 0 | 4.5 s | — |
| Quick capture | 10/10 | 0 | 0 | 2.1 s | 80%: every date exact |
| Sort apps | 10/10 | 0 | 0 | 4.9 s | 86%: expected category |
| Ask | 10/10 | 0 | 0 | 2.2 s | 100%: answers, or declines when the data cannot answer |
| Break idea | 10/10 | 0 | 0 | 0.6 s | — |

This is one model on one machine and one made-up day. It shows that the checks and the fallback do their job; it does not predict how every model will do on every user's data.

## What I learned

With a small model, reliability comes from deciding what the model is allowed to own. It can choose words and order; the program owns dates, arithmetic and facts, and checks everything else. A fallback is only honest if the interface says when it was used.
