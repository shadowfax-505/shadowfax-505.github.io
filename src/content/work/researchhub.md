---
title: ResearchHub
summary: A research discovery and collaboration app on Oracle — paper search, citations, collections, questions and messaging — with its business rules enforced in the database and covered by integration tests.
kind: selected
order: 3
year: 2026
role: Database, API and web front end
stack: [Oracle, PL/SQL, Express, Next.js, React, JWT]
statuses: [tested]
metrics:
  - { value: '65', label: 'live Oracle integration checks pass', status: tested }
  - { value: '27', label: 'API unit checks pass', status: tested }
  - { value: '8', label: 'desktop and mobile browser journeys pass', status: tested }
  - { value: '0', label: 'WCAG A/AA violations on the main pages (axe)', status: tested }
cover: { src: /assets/researchhub-feed.webp, alt: 'ResearchHub discovery feed showing recommended papers and research activity', width: 1280, height: 889, caption: 'The discovery feed, captured from the app running locally against Oracle with seeded records.' }
figures:
  - { src: /assets/researchhub-collections.webp, alt: 'ResearchHub collections page with saved papers grouped into folders', width: 1280, height: 782, caption: 'Saved collections.' }
links:
  - { label: Repository, url: 'https://github.com/shadowfax-505/ResearchHub' }
  - { label: Redesign pull request, url: 'https://github.com/shadowfax-505/ResearchHub/pull/1' }
  - { label: Verification record, url: 'https://github.com/shadowfax-505/ResearchHub/blob/34dc07cf06f85aea4556d9c0c82de323521808bd/docs/VERIFICATION_2026-10-11.md' }
---
## The problem

Finding a paper is the easy part. Researchers also need to keep collections, follow people and topics, ask and answer questions, and request full texts. All of that has to respect privacy settings, blocks and drafts.

## What I built

A Next.js front end, an Express API and an Oracle database with migrations, PL/SQL packages and triggers. It covers paper search, citations, saved collections, follows, Q&A, full-text requests, messaging, jobs and projects, and moderation analytics, with JWT authentication.

## Engineering choices

- Ownership and permissions are checked against the database on every authenticated request, not cached in the token.
- Account creation, authorship, library moves, answers and votes run inside transactions; repeated saves and votes are safe to retry.
- Private drafts, profile visibility, message consent and blocks are enforced server-side.
- When Oracle is down, the API returns a clear connection error rather than pretending a write succeeded.
- Migrations are tracked and never drop or silently reset existing data.

## Status

The browser journeys cover sign-in, search, saving papers across reloads, exporting a library, uploading and downloading the same PDF bytes, and updating projects. These are tests of the local build; the papers and names in the screenshots are seeded development data. A public deployment still needs a hosted Oracle instance and working email delivery.
