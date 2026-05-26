# CalmCampus

CalmCampus is a student wellness and planning website built with React and Vite. It includes login/register, user-specific localStorage data, a dashboard, study planners, a Talk Assistant, ambience audio, and quick calm tools.

## Features

- Login and register
- User-specific local data
- Dashboard
- Single Planner
- Detailed Planner
- Saved plans
- Talk Assistant
- Quick calm tools
- Background ambience audio
- Soft mode and sound controls

## Installation

```bash
npm install
```

## Local environment

Create `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_key_here
```

You can add one or more Talk Assistant provider keys in `.env.local`. Missing keys are skipped automatically, and the backend tries providers in order before using a local friendly fallback. See `.env.example` for the full key and optional model override list.

## Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Notes

The app stores demo user data locally in the browser using localStorage.
