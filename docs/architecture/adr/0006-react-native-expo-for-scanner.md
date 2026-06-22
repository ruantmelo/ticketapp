# ADR 0006: React Native + Expo for Scanner App

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |

## Context

The validator / door staff persona needs a mobile app to scan dynamic QR codes, verify ticket authenticity on-chain, and admit attendees. The app must be fast, reliable, work on both iOS and Android, and be deployable to non-technical staff with minimal friction. It also needs offline capabilities (F-VAL-02).

## Considered Options

### Option 1: React Native + Expo
- **Pros**: Cross-platform (iOS + Android) from a single TypeScript codebase; shares language and some utilities with the web frontend (React, TypeScript); Expo provides managed camera access, QR/barcode scanning APIs, and over-the-air (OTA) updates — critical for distributing fixes to staff devices without App Store review delays; Expo's EAS build handles native compilation; large ecosystem.
- **Cons**: Slightly lower raw camera performance than native (though Expo's camera module is well-optimized); some advanced native features may require ejecting or custom native modules.

### Option 2: Flutter
- **Pros**: Excellent cross-platform performance; single Dart codebase; strong camera/scanning libraries; good offline data handling.
- **Cons**: Dart is a different language from the TypeScript used in the web frontend and backend — fragments team skills; smaller Web3 library ecosystem (though basic signing is available); no OTA updates equivalent to Expo.

### Option 3: Native (Swift for iOS + Kotlin for Android)
- **Pros**: Best possible camera and QR scanning performance; full access to platform APIs; best offline/local-storage control.
- **Cons**: Two separate codebases and languages; doubles development and maintenance effort; slower iteration; harder to find developers for both platforms; no code sharing with the web team.

## Decision

We choose **React Native + Expo** for the scanner app.

## Rationale

- Cross-platform from one TypeScript codebase dramatically reduces development and maintenance effort for a team that is already working in TypeScript (frontend + backend).
- Expo's managed workflow and OTA updates are a decisive advantage: door staff devices can receive bug fixes and configuration updates without App Store / Play Store review, which is critical during a live event.
- Expo provides first-class camera and barcode scanning modules (`expo-camera`, `expo-barcode-scanner`) suitable for the QR validation use case.
- TypeScript alignment means the scanner app can share types (contract ABIs, QR payload types, API types) with the rest of the codebase.
- viem (ADR 0004) can be used in React Native for signature recovery and contract reads, keeping the Web3 stack consistent across platforms.

## Consequences

- The scanner app is built with React Native using the Expo managed workflow.
- Camera and QR scanning use Expo's camera modules.
- Signature verification uses viem (same library as the web frontend and backend).
- OTA updates via Expo Updates allow rapid fixes during events.
- If raw camera performance proves insufficient for high-speed scanning at very large events, a native module can be added without abandoning React Native.
