# Fixing Critical Missing Features - Implementation Plan

## What I'm Fixing RIGHT NOW

### 1. ✅ Token Family System (Database Schema Added)
- Added `RefreshToken` model to schema
- Need to update `generateTokens()` to use database
- Need to update `/refresh` endpoint with reuse detection

### 2. ⏳ Request Queue System (Next)
- Implement interceptor queue in `app/src/lib/api.ts`
- Handle concurrent 401s properly

### 3. ⏳ Nonce for Apple Sign-In
- Add nonce generation in LoginScreen
- Add nonce validation in backend

### 4. ⏳ Argon2id Parameters
- Update to match document specs

## Implementation Status

Starting with Token Family System - the most critical security issue.

