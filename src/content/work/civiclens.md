---
title: CivicLens
summary: A Laravel platform that connects public projects, budgets, procurement, contractors and documents, and flags inconsistencies with rules that always show their evidence.
kind: selected
visual: civic
category: Full-stack engineering
order: 2
year: 2026
role: Full-stack developer — data model, workflows, integrity engine, tests
stack: [Laravel, PHP, MySQL, Redis, Docker, Pest, Playwright]
statuses: [shipped, tested]
metrics:
  - { value: '45', label: 'database migrations behind 18 service domains' }
  - { value: '103', label: 'Pest feature and unit test files, plus 8 Playwright specs', status: tested }
  - { value: 'Level 8', label: 'PHPStan / Larastan static analysis on the app layer', status: tested }
  - { value: 'v1.0.0', label: 'tagged release, validated on a local Docker production stack' }
cover: { src: /assets/civiclens-public.webp, alt: 'CivicLens public transparency portal showing counts of public projects, tenders and documents and links to browse them', width: 1200, height: 593, caption: 'The public transparency portal, captured from the app running locally with seeded records.' }
figures:
  - { src: /assets/civiclens-analytics.webp, alt: 'CivicLens executive decision dashboard with filters for fiscal year, agency and date range', width: 1200, height: 593, caption: 'The analytics dashboard, with snapshot and CSV report jobs.' }
links:
  - { label: Repository, url: 'https://github.com/shadowfax-505/CiviLens' }
  - { label: v1.0.0 README, url: 'https://github.com/shadowfax-505/CiviLens/blob/e35432cb8a1596c9304ed49d332d881479b842cd/README.md' }
---
## The problem

Information about a public project is scattered: the budget sits in one register, the tender in another, the contractor's history somewhere else, and citizen complaints nowhere at all. Each record looks fine alone. The problems show up only when they are put side by side.

## What I built

CivicLens puts geography, agencies, projects, budgets, procurement and contracts, contractors and documents into one schema with universal search across them. On top of that sit analytics and reports (CSV, spreadsheet, PDF), a public transparency portal and citizen reporting, all behind role- and permission-based access with an activity log.

The core is the **Civic Integrity Engine**. Deterministic rules look for patterns such as repeated revisions of a tender notice, an unusual number of contract amendments, or a value far out of line with comparable records. Each finding carries the evidence that triggered it and an explanation. Rules can be dry-run before they are switched on, and every change to a rule is audited. A finding is a reason for a person to look, never a verdict.

## Engineering choices

- Authorization is treated as behaviour to test: policies plus feature tests for who can see and change what.
- No machine learning in v1, on purpose. Every signal can be reproduced from the data and explained to the person it concerns.
- Production concerns are part of the code: health and version endpoints, request correlation IDs, security headers, and a Docker stack with app, worker, Nginx, MySQL and Redis.
- Thirty-eight design documents (architecture, database, security, testing, deployment) are kept next to the code, with architecture decision records for anything that changes them.

## Status

v1.0.0 runs on a local production-style Docker stack. It is not publicly hosted; that needs HTTPS, backups and monitoring on a real provider.
