# TRANSCRIPT AI · PSY — CLAUDE.md

## Project Mission

TRANSCRIPT AI · PSY is an AI-assisted workspace for practicing psychologists.

The product helps psychologists:

* manage clients;
* store consultations;
* create transcripts;
* maintain client history;
* run AI-assisted analysis;
* continue case exploration through consultation chat.

The primary goal is not CRM functionality.

The primary goal is helping a psychologist work with client material.

---

# Core Product Principle

Do not add new functionality if the core workflow is not complete.

Priority order:

1. Client
2. Consultation
3. Transcript
4. AI Analysis
5. Consultation Chat
6. Client History

Every implementation decision should support this workflow.

---

# Current MVP Goal

The MVP is considered successful when the following flow works reliably:

Client → Consultation → Transcript → Analysis → Chat → Client History

Anything outside this flow is secondary.

---

# Things NOT To Do

Do not introduce:

* authentication;
* billing;
* subscriptions;
* user roles;
* multi-user support;
* team collaboration;
* complex analytics;
* large-scale refactoring.

Do not redesign the entire UI unless explicitly requested.

Do not modify knowledge base content without approval.

Do not connect Supabase until the core workflow is stable.

---

# Client Structure

Each client contains:

## Overview

Short summary of the case.

## Consultations

List of consultation sessions.

## Client History

Structured long-term context.

Sections:

* Key themes
* Working hypotheses
* Resources
* Significant life events
* What has already been explored
* What requires further exploration
* Therapist notes

Use the name:

"Client History"

Never use:

"Client Memory"

## Materials

Imported files and reference material:

* therapist notes;
* previous GPT analyses;
* historical transcripts;
* intake forms;
* additional documentation.

---

# Consultation Creation

Supported sources:

## Audio Recording

Formats:

* mp3
* m4a
* wav

Flow:

Audio → Whisper → Transcript → Analysis

---

## Existing Transcript

Formats:

* txt
* md

Or pasted text.

Flow:

Transcript → Analysis

---

## Therapist Notes

Manual text entry.

Flow:

Notes → Analysis

Notes must be clearly identified as notes, not a full transcript.

---

# Consultation Page

The consultation page is the most important screen.

Structure:

## Consultation Header

Shows:

* client name;
* session number;
* date;
* duration;
* status;
* actions.

The client name must not be used as the header of the AI Analysis panel.

---

## Three Working Panels

### 🎙 Transcript

Client and therapist dialogue.

### 🧠 AI Analysis

Observations, hypotheses, directions for exploration.

### 💬 Consultation Chat

Questions about the current session.

---

# Scroll Behavior

This is critical.

Expected behavior:

* sidebar remains fixed;
* consultation header remains visible;
* transcript panel scrolls independently;
* analysis panel scrolls independently;
* chat panel scrolls independently;
* chat input remains fixed at the bottom.

Do not rely on page-level scrolling.

Check:

* h-screen
* min-h-0
* overflow-hidden
* overflow-y-auto

A missing min-h-0 is a common cause of broken panel scrolling.

---

# Collapsible Panels

Transcript, Analysis and Chat panels should support collapse/expand.

When collapsed:

* panel becomes a narrow tab;
* content is hidden;
* remaining panels expand automatically.

Do not use checkboxes.

Use dedicated panel controls.

---

# Analysis Modes

Supported modes:

## working

Working Analysis

## deep

Deep Analysis

## therapist_process

Therapist Process Analysis (+A)

## gestalt

Gestalt Analysis (+G)

Use:

therapist_process

Do not use:

therapist

---

# Knowledge Base

Location:

knowledge_base/

Main file:

000_CORE_INSTRUCTIONS.md

This file must always be loaded first.

Prompt composition order:

1. Core Instructions
2. Knowledge Map
3. Mode-specific files
4. Client Context
5. Transcript / Notes
6. Current Task

---

# Client Context

Client context should be assembled from:

* client profile;
* Client History;
* Materials;
* previous consultations;
* previous analyses.

The context should be concise and relevant.

---

# LLM Providers

Architecture should support:

* OpenAI
* Anthropic
* DeepSeek

Current default:

OpenAI

Anthropic and DeepSeek may remain mock implementations.

---

# Whisper

Use OpenAI Whisper API.

Flow:

Audio File → Whisper → Transcript → Consultation

If transcript already exists, require confirmation before regenerating.

---

# Materials Inside Consultation

A consultation may contain:

* audio recording;
* transcript;
* AI analysis.

These should be presented as consultation assets.

Example:

🎧 Audio Recording

📝 Transcript

🧠 AI Analysis

---

# Data Storage

Local JSON storage is acceptable for MVP.

However:

Railway filesystem is ephemeral.

Files stored inside:

* data/
* public/uploads/

may disappear after redeploy.

Design future architecture with migration to Supabase in mind.

Do not connect Supabase yet.

---

# Git Safety

Never commit:

* .env
* .env.local
* API keys
* node_modules
* .next
* public/uploads
* data

Always verify before commit.

---

# Deployment

Before deployment run:

npm run build

Deployment target:

Railway

Repository:

GitHub

---

# How To Work

Before large changes:

1. Explain the plan.
2. List affected files.

After changes:

1. List modified files.
2. Explain what changed.
3. Provide manual test instructions.
4. Identify what is still mock.

---

# Current Priority

Finish:

Client → Consultation → Transcript → AI Analysis → Chat → Client History

Before introducing major new features.
