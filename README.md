# CalmCampus

CalmCampus is a student wellness and study planning web application built using React and Vite. It is designed to help students plan their day, manage saved study plans, use calming tools, listen to ambience audio, and talk with a study support assistant.

## Objective

The main objective of this project is to create a simple and calming digital space for students where they can organize study tasks, reduce stress, and get support while studying.

CalmCampus combines study planning, relaxation tools, ambience sound, and a chatbot-style Talk Assistant in one platform.

## Features

- Login and register system
- User-specific local data
- Dashboard
- Single Planner
- Detailed Planner
- Saved plans
- Talk Assistant
- Quick Calm Tools
- Breathing tool
- Background ambience audio
- Soft mode and sound controls
- Windows desktop app version
- Android APK version

## How to Use

### 1. Login / Register

Users can create an account or log in to access their personal dashboard. The app keeps user data separate so each user can have their own saved plans and settings.

### 2. Dashboard

The dashboard gives a quick view of the main features. From here, users can open the planner, Talk Assistant, or Quick Calm Tools.

### 3. Single Planner

The Single Planner is useful when the user wants to create a plan quickly.

It is best for:
- Quick study planning
- Simple daily schedules
- Times when the user wants an easy and fast planner
- Students who do not want too many options

The user can enter the study details, and the planner helps create a simple study plan.

### 4. Detailed Planner

The Detailed Planner is for users who want more control and more options while making a plan.

It is best for:
- More customized planning
- Multiple subjects or tasks
- Longer study sessions
- More detailed schedule creation
- Students who want a more organized plan with extra options

This planner gives more flexibility compared to the Single Planner.

### 5. Saved Plans

Users can save their generated plans and view them later. This helps students keep track of their study schedules without creating the same plan again.

### 6. Talk Assistant

The Talk Assistant is a chatbot-style feature where the user can type anything related to studying, stress, planning, motivation, or general student doubts.

Users can type their question or problem, and the assistant will respond like a supportive study helper.

Examples:
- “I don’t feel like studying.”
- “Help me plan for my exam.”
- “I am stressed.”
- “Explain how I should revise.”
- “I have too many chapters left.”

### 7. Quick Calm Tools

Quick Calm Tools are made to help users calm down quickly when they feel stressed, anxious, distracted, or overwhelmed.

These tools include calming exercises such as breathing and grounding activities.

### 8. Ambience Audio

The app includes background ambience audio to create a calm study environment. Users can turn sound on or off based on preference.

### 9. Soft Mode

Soft Mode gives the app a more gentle and calm experience. It is useful for students who prefer a softer, less distracting interface while studying.

## Technologies Used

- React
- Vite
- TypeScript
- Tailwind CSS
- LocalStorage
- Render for deployment
- Electron for Windows app
- Capacitor for Android APK

## Live Website

https://calmcampus.onrender.com

## Installation

Install project dependencies:

```bash
npm install
```

## Run Locally

Start the development server:

```bash
npm run dev
```

## Build

Create a production build:

```bash
npm run build
```

## Windows App

The Windows desktop app is created using Electron. It loads the deployed CalmCampus website inside a desktop app window.

## Android App

The Android APK is created using Capacitor. It is mainly designed for Android tablets and opens in landscape mode for a better view of the interface.

## Notes

The app stores user data locally in the browser using localStorage.

The Windows and Android app versions load the deployed CalmCampus website, so internet connection is required for the app versions to work properly.

API keys are not stored inside the frontend app. Provider keys are handled through the deployed server environment.
