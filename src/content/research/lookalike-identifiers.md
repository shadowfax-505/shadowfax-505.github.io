---
title: Look-alike Bengali identifiers in programming toolchains
area: Software security · Unicode
question: Can two Bengali variable names that render identically be treated as different names by real compilers and interpreters — and do the standard Unicode defences catch it?
method: Systematic generation and font rendering of spelling variants, tested against mainstream language toolchains and the standard normalisation and confusable checks.
status: disclosure
order: 2
---
Programming languages increasingly accept non-Latin identifiers. If two names look the same on screen but differ in their code points, a reviewer can be shown one function while another runs. The study maps where Bengali script allows this, how each toolchain behaves, and what an identifier profile for Bengali would need.

Affected vendors and the Unicode Consortium will be notified before any details are published.
