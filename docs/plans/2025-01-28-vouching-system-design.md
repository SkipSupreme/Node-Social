# Vouching System UI Design

**Date:** 2025-01-28
**Status:** Approved
**Priority:** A (Profile vouch) → C (My Vouches screen) → B (Trust visualization - future)

## Overview

Vouching is Node Social's web of trust system. It works like old Twitter verification - high praise with real consequences. Users stake cred on people they trust. If a vouched user abuses trust, the voucher loses their staked cred and reputation damage cascades downstream.

### Core Philosophy

- **Cold start solution:** Seed trusted community members with cred, they vouch for people they know
- **Consequences cascade:** Vouch for a bad actor → lose cred → your trust network affected
- **High stakes:** 50% penalty to revoke a vouch (you made a bad call, own it)
- **Human-first:** Councils govern nodes, AI moderation comes later at scale

## Component 1: Profile Vouch Section

**Location:** ProfileScreen, new section below user bio/stats

### Display States

**Default (not vouched):**
```
┌─────────────────────────────────────────┐
│  🤝 Web of Trust                        │
│                                         │
│  Vouched by 12 people (2,400 cred)      │
│  [avatar][avatar][avatar] +9 more       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [ Vouch 100 ] [ 500 ] [ 1000 ] │    │
│  │  [ Custom amount... ]           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Already vouched:**
```
┌─────────────────────────────────────────┐
│  🤝 Web of Trust                        │
│                                         │
│  Vouched by 12 people (2,400 cred)      │
│  [avatar][avatar][avatar] +9 more       │
│                                         │
│  ✓ You vouched 500 cred  [Revoke]       │
└─────────────────────────────────────────┘
```

**Can't vouch:**
- Grayed out buttons with reason: "Need 100+ cred to vouch"

### Data Shown

- Total vouch count
- Total cred staked on this user
- Top 3 voucher avatars (highest cred vouchers = social proof)
- Whether current user has vouched + their stake amount

## Component 2: Gravity Modal (Vouch Confirmation)

**Triggered by:** Clicking any vouch button (100/500/1000/custom)

```
┌─────────────────────────────────────────┐
│                                         │
│         🤝 Vouch for @username          │
│                                         │
│  You're staking 500 cred on this user.  │
│                                         │
│  ⚠️  What this means:                   │
│                                         │
│  • If they abuse trust, you lose        │
│    this cred AND your reputation        │
│  • Your vouch chain is affected -       │
│    people you've vouched for may        │
│    lose trust too                       │
│  • Revoking later costs 50% of stake    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      Confirm Vouch (500)        │    │
│  └─────────────────────────────────┘    │
│                                         │
│            Cancel                       │
│                                         │
└─────────────────────────────────────────┘
```

### UX Notes

- Confirm button: Accent color, prominent
- Cancel: Text link below, easy escape
- Purpose: Make the weight of the decision felt

## Component 3: Revoke Modal

**Triggered by:** Clicking "Revoke" on a vouch you've given

```
┌─────────────────────────────────────────┐
│                                         │
│         ⚠️ Revoke Vouch                 │
│                                         │
│  You vouched 500 cred for @username     │
│                                         │
│  Revoking costs 50% of your stake:      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   -250 cred                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  This cred is lost permanently.         │
│  Your remaining stake (250) returns     │
│  to you.                                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Revoke & Lose 250 Cred        │    │
│  └─────────────────────────────────┘    │
│                                         │
│            Keep Vouch                   │
│                                         │
└─────────────────────────────────────────┘
```

### UX Notes

- Revoke button: Red/warning color
- Keep Vouch: Safe exit, text link
- Show exact cred loss prominently

## Component 4: My Vouches Screen

**Location:** Left sidebar menu item with handshake icon (🤝)

```
┌─────────────────────────────────────────┐
│  ← My Vouches                           │
│                                         │
│  Total Staked: 2,400 cred               │
│  Given: 8  •  Received: 12  •  Revoked: 2│
│                                         │
│  ┌──────┬──────┬──────────┬─────────┐   │
│  │ All  │Given │ Received │ Revoked │   │
│  └──────┴──────┴──────────┴─────────┘   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ [avatar] @sarah_dev             │    │
│  │ 500 cred staked • 3 months ago  │    │
│  │              [View] [Revoke]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ [avatar] @mike_calgary          │    │
│  │ 100 cred staked • 2 weeks ago   │    │
│  │              [View] [Revoke]    │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### Filter Chips

- **All:** Shows given + received interleaved by date
- **Given:** Vouches you've given (shows Revoke button)
- **Received:** Vouches others gave you (View only)
- **Revoked:** History with penalty shown in red ("-250 cred penalty")

### Actions per Vouch

- **Given vouches:** View profile, Revoke
- **Received vouches:** View profile only
- **Revoked vouches:** View profile only (read-only history)

## Backend Changes Required

### Revoke Penalty Logic

Update `DELETE /api/v1/vouch/:userId` to:

1. Calculate 50% penalty of staked cred
2. Deduct penalty from voucher's cred balance
3. Record penalty amount in vouch record for history
4. Return updated vouch with penalty info

### Schema Addition

Add to Vouch model:
```prisma
penaltyPaid Int? // Cred lost when revoked
```

### New Endpoint

`GET /api/v1/vouch/history` - Returns revoked vouches with penalty info

## Frontend Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/VouchSection.tsx` | Profile vouch stats + buttons |
| `src/components/ui/VouchModal.tsx` | Gravity confirmation modal |
| `src/components/ui/RevokeVouchModal.tsx` | Revoke with penalty warning |
| `src/screens/MyVouchesScreen.tsx` | Vouch management screen |

## Frontend Files to Modify

| File | Change |
|------|--------|
| `src/screens/ProfileScreen.tsx` | Add VouchSection component |
| `src/components/ui/Sidebar.tsx` | Add My Vouches nav item |
| `App.tsx` | Add 'vouches' to currentView, render MyVouchesScreen |
| `src/lib/api.ts` | Add API functions (already exist, just need to use them) |

## Future: Trust Network Visualization (Phase B)

Interactive map showing:
- Your position in the trust network
- Who you've vouched for (outgoing connections)
- Who vouches for you (incoming connections)
- Cascading trust chains
- Could become branding identity if executed well

This is a separate design phase after core vouching UI is complete.
