# Meet Cosmo! 🤖✨

A 2026 reimagining of the classic 1990s kids body-parts learning game — rebuilt with Three.js, a fully 3D metallic robot, eye tracking, a star-field background, and zero image or audio assets.

## Play it

👉 **[daviddotshaw.github.io/meet-cosmo](https://daviddotshaw.github.io/meet-cosmo/)**

## About

Cosmo is a 3D chrome-and-gold robot who teaches young children (ages 2–5) the names of body parts. Tap any part of his body to hear it named, or jump into Quiz Mode for a star-scoring challenge. The whole character — lighting, animation, reflections — is generated in real-time in your browser.

## Features

### 🔍 Explore Mode
Tap Cosmo's ears, eyes, nose, mouth, tummy, hands, or feet. Each part flashes, bounces, and 3D particles burst outward while Cosmo tells you all about it in a friendly voice.

### ⭐ Quiz Mode
Cosmo asks *"Can you find my hands?"* and waits for you to tap the right spot. Earn a star for each correct answer. Find all seven parts and trigger a full confetti celebration!

### Technical highlights

| Feature | Detail |
|---|---|
| **3D engine** | Three.js r152, WebGL renderer, PCFSoft shadow maps |
| **5-point lighting** | Warm key · cool fill · cyan rim · purple under-glow · screen/antenna point lights |
| **Eye tracking** | Cosmo's pupils smoothly follow the mouse or finger |
| **Star field** | 3,000 depth-attenuated stars + 60 bright foreground stars + nebula glow |
| **3D particles** | Burst particles fly outward with gravity on each tap |
| **Web Speech API** | Natural browser voice — Cosmo can say his own name perfectly |
| **Web Audio API** | Programmatic tones for touch, success, wrong, and cheer sounds |
| **PWA** | Installable, works offline after first load |
| **No external assets** | Everything generated in code — no images, no audio files |

## Body parts

Ears · Eyes · Nose · Mouth · Tummy · Hands · Feet

## Compared to the original

| | Learn with Minni (1993) | Meet Cosmo (2026) |
|---|---|---|
| Graphics | 256-colour bitmap | Real-time 3D, ray-traced shadows |
| Audio | Pre-recorded WAV files | Web Speech + synthesised audio |
| Screen | 640×480 VGA | Any resolution, any device |
| Install | Floppy disk | Tap "Add to Home Screen" |
| Network | Offline only | Offline PWA |

## Inspired by

The original *Learn with Minni* (early 1990s DOS game) — this is its spiritual successor, built with everything 30 years of browser technology has to offer.
