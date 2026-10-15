---
title: PaperTok
orbit: high
status: active
launched: 2025-06-01
oneLiner: A short-form, swipeable feed for discovering arXiv papers.
stack: [React, Vite, Firebase, KaTeX, Transformers.js, Python]
links:
  - label: papertok.app
    url: https://papertok.app
  - label: GitHub
    url: https://github.com/mugar123/papertok
order: 1
---

## Problem

Students and researchers rarely discover literature outside their existing reading habits.

## What I built

A full web application that reformats arXiv preprints into a swipeable, TikTok-style feed. A recommendation engine builds a semantic profile from each user's interactions and ranks incoming preprints against it.

KaTeX renders the maths in the browser, Transformers.js (Xenova) computes embeddings on the client, and a Python proxy talks to the arXiv API. Firebase handles auth, Firestore and hosting, hardened after an internal security review.

## Outcome

Live at [papertok.app](https://papertok.app), with around 100 users since launch.
