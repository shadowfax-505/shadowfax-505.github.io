---
title: Compilers as constrained decoders
area: Programming languages · LLMs
question: Can an ordinary compiler front end, used unchanged, tell a language model early that the code it is writing can no longer become a valid program?
method: A prefix checker derived from an existing compiler, verified against reference compilers, then used to guide code generation in open code models on a standard benchmark.
status: manuscript
order: 3
---
Grammar-constrained decoding usually needs a hand-written grammar that drifts from the real language. This work asks whether the compiler a language already has can serve as the constraint, so the model is steered by the same rules that will later judge its output.

Larger-model runs are in progress. The work grew out of my compiler-lab project, the BanglaCode compiler.
