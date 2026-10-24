---
title: What a 1.7-billion-parameter model is allowed to decide
date: 2026-10-24
summary: The mistakes a small local model made in ZenFlow, the checks that catch them, and why moving date arithmetic into code did more than any prompt.
draft: false
---
[ZenFlow](/work/zenflow/) has seven AI features: a day plan, a daily review, a weekly report, questions about your own focus data, quick capture of reminders, sorting apps into categories, and break ideas. They run on qwen3:1.7b through Ollama, on the same laptop. A model that small answers in a few seconds and never sends your day anywhere. It is also wrong in ways a larger model usually is not.

## What it got wrong

Watching it run against a fixed demo day, the same kinds of mistakes kept coming back:

- **Dates.** Given sentences like "call the bank tomorrow at 3 pm and submit the lab report on Friday" or "dentist next Monday at 10am", only 2 runs in 10 produced the right reminders with every date exact.
- **Goals.** With half the daily goal done, a review said the goal had been achieved.
- **Arithmetic.** An answer said 80 minutes were left when 70 were.
- **Time of day.** An answer called 10:00 to 13:00 "the afternoon".
- **Runaway output.** Under a JSON schema, one answer kept generating for two minutes.

None of these show up in a demo where you look at one answer and move on. They show up when you run the same task ten times.

## The rules

Every feature now goes through the same pipeline:

1. **Schema.** Each task has a JSON schema that Ollama enforces. Reasoning is switched off and output is capped at 600 tokens, which ended the runaway answers.
2. **Checks.** The answer is tested against the data the model was given. Every number it writes must appear in that data or follow directly from it. It may not say a goal was met when it was not. Minutes left must add up. A part of the day must match the hour it names. A plan may only use the user's real reminders and must fit the time left.
3. **One retry, with the reason.** A failed answer goes back to the model once, told exactly which check failed, at a lower temperature.
4. **Rules, in plain view.** If the retry fails too, or no model is running, ZenFlow writes the answer from rules, and the card says so.

## The change that mattered most

I tried to fix the dates with better prompts. It did not work. What worked was taking the decision away from the model: it now copies the "when" phrase from your sentence ("Friday", "next Monday", "tomorrow at 3 pm"), and a small resolver in code turns that phrase into a date. Exact dates went from 2 in 10 runs to 8 in 10.

The general rule I took from it: let the model choose words and order. Let the program own dates, arithmetic and facts, and check everything else.

## Measured, not assumed

An evaluation harness runs every task ten times against the real model and writes a [report](https://github.com/shadowfax-505/Zenflow/blob/main/docs/ai-eval.md). On the last run, 69 of 70 answers were usable on the first try, the retry saved the one that was not, and no run fell back to rules. App sorting matched the expected category 86% of the time, so there is still room to improve.

That is one model on one machine (an M1 MacBook Air with 8 GB) and one made-up day. It shows the checks do their job. It does not predict how every model will do on every user's data, and the report says so.
