# Node Social: The Ultimate To-Do List

This document serves as the final roadmap to complete the Node Social web application. 

# Node Social Vibe System - Unified Technical Specification

**Version:** 1.0.0  
**Last Updated:** November 24, 2025  
**Status:** Implementation Ready  
**Target Platforms:** React Native + Expo (Mobile), React (Web), Fastify (Backend)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [The Six Vibe Vectors](#3-the-six-vibe-vectors)
4. [The Radial Wheel Interface](#4-the-radial-wheel-interface)
5. [The Vibe Validator (Feed Algorithm Control)](#5-the-vibe-validator-feed-algorithm-control)
6. [Scoring Engine & Ranking Algorithms](#6-scoring-engine--ranking-algorithms)
7. [Comment Sorting System](#7-comment-sorting-system)
8. [Moderation Queue Integration](#8-moderation-queue-integration)
9. [ConnoisseurCred Reputation System](#9-connoisseurcred-reputation-system)
10. [Database Schema](#10-database-schema)
11. [API Endpoints](#11-api-endpoints)
12. [Frontend Implementation Guide](#12-frontend-implementation-guide)
13. [Performance & Infrastructure](#13-performance--infrastructure)
14. [Anti-Gaming & Sybil Resistance](#14-anti-gaming--sybil-resistance)
15. [Implementation Roadmap](#15-implementation-roadmap)

---

## 1. Executive Summary

### 1.1 What We're Building

The Vibe System is Node Social's core differentiator—a complete reimagining of how users interact with content and control their feeds. It consists of three interconnected components:

1. **Vibe Vectors**: Six multi-dimensional reactions with intensity control (0-100%), replacing binary upvote/downvote
2. **Radial Wheel**: A gesture-based interface for selecting reactions with fluid intensity adjustment
3. **Vibe Validator**: User-controlled algorithm sliders that expose feed ranking parameters to end users

### 1.2 Why This Matters

Current platforms optimize for engagement (time-on-site, ad impressions) using opaque algorithms. This creates a "Principal-Agent" failure where the algorithm maximizes metrics that don't align with user satisfaction, leading to rage-bait amplification, filter bubbles, and toxic content.

Node Social inverts this model:

- **From Implicit to Explicit**: Instead of inferring preferences from behavior, we let users tell us what they want
- **From Binary to Continuous**: Instead of Like/Dislike, we capture emotional nuance across six dimensions with intensity
- **From Opaque to Transparent**: Instead of hidden algorithms, we expose every parameter to user control

### 1.3 Core Innovation

The combination of **high-fidelity input data** (6D vectors with intensity) and **user-controlled algorithm parameters** (Vibe Validator) creates a feedback loop that no competitor can match:

```
User adjusts Vibe Validator → Algorithm changes → Feed updates → 
User reacts with Vibe Vectors → Data enriches user profile → 
Algorithm learns → Better recommendations → User satisfaction increases
```

### 1.4 Technical Stack Integration

| Layer | Technology | Vibe System Role |
|-------|------------|------------------|
| Mobile | React Native + Expo SDK 54 | Radial Wheel gestures, Vibe Validator UI |
| Web | React | Same components via shared codebase |
| API | Fastify + Node.js 22 | Scoring endpoints, reaction storage |
| Database | PostgreSQL 16 | Reaction storage, user configs |
| Vector Search | pgvector / MeiliSearch | Similarity-based recommendations |
| Cache | Redis 7 | Real-time score aggregation |
| Background Jobs | BullMQ | Feed recalculation, Cred updates |

---

## 2. System Architecture Overview

### 2.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Radial Wheel   │  │ Vibe Validator  │  │   Feed View     │         │
│  │  (Reactions)    │  │ (Algorithm UI)  │  │   (Results)     │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
└───────────┼────────────────────┼────────────────────┼───────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Fastify)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ POST /reactions │  │ PUT /vibe-config│  │ GET /feed       │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
└───────────┼────────────────────┼────────────────────┼───────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Reaction Engine │  │  Config Store   │  │ Scoring Engine  │         │
│  │ - Validate      │  │ - User prefs    │  │ - Quality       │         │
│  │ - Store         │  │ - Presets       │  │ - Recency       │         │
│  │ - Aggregate     │  │ - Experiments   │  │ - Engagement    │         │
│  │ - Notify        │  │                 │  │ - Personal      │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
└───────────┼────────────────────┼────────────────────┼───────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   PostgreSQL    │  │     Redis       │  │   BullMQ        │         │
│  │ - Reactions     │  │ - Score cache   │  │ - Cred updates  │         │
│  │ - User configs  │  │ - Session data  │  │ - Feed refresh  │         │
│  │ - Cred scores   │  │ - Rate limits   │  │ - Mod queue     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Data Structures

#### Vibe Vector (Per-Reaction)

```typescript
interface VibeVector {
  insightful: number;  // 0.0 - 1.0
  joy: number;         // 0.0 - 1.0
  fire: number;        // 0.0 - 1.0
  support: number;     // 0.0 - 1.0
  shock: number;       // 0.0 - 1.0
  questionable: number; // 0.0 - 1.0
}

// Example: User finds post both funny and insightful
const reaction: VibeVector = {
  insightful: 0.90,
  joy: 0.60,
  fire: 0.0,
  support: 0.0,
  shock: 0.0,
  questionable: 0.0
};
```

#### Aggregated Post Vibe (Computed)

```typescript
interface PostVibeAggregate {
  postId: string;
  
  // Sum of all intensity values per vector
  insightfulSum: number;
  joySum: number;
  fireSum: number;
  supportSum: number;
  shockSum: number;
  questionableSum: number;
  
  // Count of reactions that included each vector (intensity > 0)
  insightfulCount: number;
  joyCount: number;
  fireCount: number;
  supportCount: number;
  shockCount: number;
  questionableCount: number;
  
  // Total unique reactors
  totalReactors: number;
  
  // Total intensity across all vectors (for magnitude calculations)
  totalIntensity: number;
  
  // Weighted sums (by reactor Cred)
  weightedInsightful: number;
  weightedJoy: number;
  // ... etc
  
  // Computed scores
  qualityScore: number;
  engagementScore: number;
  flagScore: number;  // For moderation
  
  // Timestamps
  firstReactionAt: Date;
  lastReactionAt: Date;
  
  // Velocity tracking
  reactionsLastHour: number;
  reactionsLast4Hours: number;
}
```

#### User Vibe Profile (Learned)

```typescript
interface UserVibeProfile {
  userId: string;
  
  // Average intensities when user reacts (what they give)
  givenProfile: VibeVector;
  
  // Average intensities of content they react to (what they like)
  receivedProfile: VibeVector;
  
  // Node-specific profiles
  nodeProfiles: Map<string, {
    given: VibeVector;
    received: VibeVector;
    cred: number;
  }>;
  
  // Vibe Validator configuration
  vibeConfig: UserVibeConfig;
  
  // Learning window
  profileWindowDays: number;
  lastUpdated: Date;
}
```

---

## 3. The Six Vibe Vectors

### 3.1 Vector Definitions

The six vectors were selected to cover the psychological dimensions of Valence (positive/negative) and Arousal (high/low energy), while integrating Utilitarianism (helpfulness) and Hedonism (pleasure) value systems.

| Vector | Icon | Color | Hex | Core Meaning | Valence | Arousal |
|--------|------|-------|-----|--------------|---------|---------|
| **Insightful** | 💡 Lightbulb/Prism | Cyan/Blue | #00BFFF | Knowledge, analysis, utility | Positive | Low-Med |
| **Joy** | 😄 Laughing/Sparkles | Yellow/Gold | #FFD700 | Amusement, delight, fun | Positive | Medium |
| **Fire** | 🔥 Flame | Orange/Red | #FF4500 | Intensity, hype, heat | Neutral | High |
| **Support** | 💙 Heart/Hands | Pink/Coral | #FF69B4 | Empathy, solidarity, love | Positive | Low |
| **Shock** | ⚡ Lightning | Electric Green | #32CD32 | Surprise, awe, "WTF" | Neutral | High |
| **Questionable** | 🤔 Monocle/Eyebrow | Purple/Grey | #9370DB | Skepticism, doubt, scrutiny | Negative | Medium |

### 3.2 Psychological Justification

#### Mapping to Ekman's Basic Emotions

| Ekman Emotion | Social Media Context | Node Social Vector |
|---------------|---------------------|-------------------|
| Happiness | Amusement, Joy, Satisfaction | **Joy** |
| Surprise | Shock, Awe, Novelty | **Shock** |
| Sadness | Empathy, Grief, Solidarity | **Support** (active response) |
| Anger | Outrage, Hype, Intensity | **Fire** (energy without toxicity) |
| Disgust | Rejection, Skepticism | **Questionable** (constructive critique) |
| Fear | Warning, Caution | **Questionable** / **Shock** |
| (Intellect) | Utilitarian value | **Insightful** (non-emotional addition) |

#### Why "Fire" Instead of "Angry"

The "Fire" vector is deliberately valence-neutral while being high-arousal. This allows it to serve multiple contexts:

- **Sports/Gaming**: "On fire!" / "Clutch play!"
- **NSFW/Aesthetic**: "Hot!" / "Attractive!"
- **Debate**: "Sick burn!" / "Powerful argument!"
- **Art**: "Stunning!" / "Masterpiece!"

A dedicated "Angry" reaction would be toxic; "Fire" captures the energy without the hostility.

#### Why "Questionable" Instead of "Downvote"

Binary downvotes collapse complex sentiments:

- "I disagree with your conclusion" → Downvote
- "This is misinformation" → Downvote
- "I don't like you personally" → Downvote

"Questionable" is a **Constructive Negative** that signals "this needs scrutiny" rather than "I reject this." The intensity slider adds nuance:

- 20% Questionable = "Citation needed"
- 50% Questionable = "I'm skeptical of this claim"
- 100% Questionable = "This is likely misinformation"

### 3.3 Node-Specific Customization

Nodes can rename vectors while preserving their algorithmic function:

```typescript
interface NodeVectorConfig {
  nodeId: string;
  vectorLabels: {
    insightful: { label: string; icon: string };
    joy: { label: string; icon: string };
    fire: { label: string; icon: string };
    support: { label: string; icon: string };
    shock: { label: string; icon: string };
    questionable: { label: string; icon: string };
  };
}
```

**Examples by Community Type:**

| Base Vector | n/programming | n/art | n/relationships | n/nsfw |
|-------------|---------------|-------|-----------------|--------|
| Insightful | 💡 Elegant | 💡 Masterful | 💡 Wise | 💡 Quality |
| Joy | 😄 Funny | 😄 Beautiful | 😄 Wholesome | 😄 Playful |
| Fire | 🔥 Hot Take | 🔥 Inspired | 🔥 Passionate | 🔥 Hot |
| Support | 💙 +1 | 💙 Love | 💙 Hugs | ❤️ Love |
| Shock | 😱 WTF | 😱 Bold | 😱 Intense | 😱 Wow |
| Questionable | 🤔 Buggy | 🤔 Derivative | 🤔 Sus | 🤔 Fake |

**Moderation Control:** Nodes can disable specific vectors:

```typescript
interface NodeReactionSettings {
  nodeId: string;
  disabledVectors: ('fire' | 'shock' | 'questionable')[];
  // Support communities might disable Fire to prevent harassment
  // Safe-space communities might disable Questionable
}
```

### 3.4 Multi-Vector Reactions

Users can select multiple vectors in a single reaction:

```typescript
// User finds a post both insightful AND funny
const reaction: VibeReaction = {
  userId: 'user_123',
  postId: 'post_456',
  vectors: {
    insightful: 0.85,
    joy: 0.65,
    fire: 0.0,
    support: 0.0,
    shock: 0.0,
    questionable: 0.0
  },
  createdAt: new Date(),
  updatedAt: new Date()
};
```

**Business Rules:**

1. A user can only have ONE reaction per post (but it can span multiple vectors)
2. Reactions can be updated (user changes their mind)
3. Reactions can be deleted (user removes their reaction)
4. Total intensity across vectors is NOT capped (user can give 100% to multiple)

---

## 4. The Radial Wheel Interface

### 4.1 Interaction Model

The Radial Wheel is the primary input mechanism for Vibe Vectors. It combines:

1. **Direction**: Selects which vector(s)
2. **Distance**: Sets intensity (0-100%)
3. **Multi-touch**: Allows selecting multiple vectors

```
                        💡 Insightful
                             │
                             │
              🤔 Questionable ─────●───── 😄 Joy
                            ╱   ╲
                           ╱     ╲
                          ╱       ╲
                    ⚡ Shock ───── 🔥 Fire
                             │
                             │
                        💙 Support
```

### 4.2 Gesture Specifications

#### Mobile (React Native + Expo)

```typescript
// Required packages
// npx expo install react-native-gesture-handler react-native-reanimated

interface RadialWheelGesture {
  // Trigger: Long-press on reaction button (300ms)
  triggerDuration: 300;
  
  // Wheel appears centered on press point
  wheelRadius: 120; // dp
  
  // Vectors arranged at 60° intervals
  vectorAngleSpacing: 60;
  
  // Intensity calculation
  // 0% at center, 100% at edge
  intensityFromDistance: (distance: number) => {
    const normalized = Math.min(distance / wheelRadius, 1.0);
    return Math.round(normalized * 100) / 100; // 0.00 - 1.00
  };
  
  // Multi-vector selection
  // User drags through multiple wedges
  // Each vector gets intensity based on distance when crossing
  multiVectorMode: 'sweep' | 'pinch';
  
  // Haptic feedback at intervals
  hapticFeedbackPoints: [0.25, 0.50, 0.75, 1.00];
}
```

#### Desktop (Web)

```typescript
interface RadialWheelDesktop {
  // Trigger: Click and hold on reaction button
  triggerDuration: 200;
  
  // Or: Hover to open, click to select
  hoverMode: true;
  
  // Scroll wheel adjusts intensity
  scrollWheelIntensity: true;
  
  // Keyboard shortcuts
  shortcuts: {
    'i': 'insightful',
    'j': 'joy',
    'f': 'fire',
    's': 'support',
    'h': 'shock', // 's' taken by support
    'q': 'questionable',
    'Shift+[key]': 'max intensity (100%)',
    'Alt+[key]': 'low intensity (25%)'
  };
}
```

### 4.3 Visual Design Specifications

#### Color Palette

```css
:root {
  /* Vector Colors */
  --vibe-insightful: #00BFFF;
  --vibe-joy: #FFD700;
  --vibe-fire: #FF4500;
  --vibe-support: #FF69B4;
  --vibe-shock: #32CD32;
  --vibe-questionable: #9370DB;
  
  /* Intensity modifiers */
  --intensity-low: 0.3;     /* 0-25% */
  --intensity-medium: 0.6;  /* 26-50% */
  --intensity-high: 0.85;   /* 51-75% */
  --intensity-max: 1.0;     /* 76-100% */
  
  /* Glow effect at high intensity */
  --glow-radius: 8px;
  --glow-opacity: 0.6;
}
```

#### Icon Sizing by Intensity

```typescript
const getIconScale = (intensity: number): number => {
  // Icons grow as intensity increases
  const minScale = 0.8;
  const maxScale = 1.4;
  return minScale + (intensity * (maxScale - minScale));
};

const getGlowIntensity = (intensity: number): number => {
  // Glow only appears above 50%
  if (intensity < 0.5) return 0;
  return (intensity - 0.5) * 2; // 0 at 50%, 1 at 100%
};
```

### 4.4 Quick Reaction Mode

For users who don't want the full radial wheel:

```typescript
interface QuickReactionConfig {
  // Single tap defaults
  singleTapBehavior: 'joy_50' | 'last_used' | 'open_wheel';
  
  // Double tap
  doubleTapBehavior: 'fire_100' | 'insightful_100' | 'open_wheel';
  
  // Swipe gestures (on post card)
  swipeRightBehavior: 'support_50';
  swipeUpBehavior: 'insightful_50';
  swipeDownBehavior: 'questionable_50';
}
```

### 4.5 Accessibility Requirements

```typescript
interface AccessibilityRequirements {
  // Screen reader support
  announceReactionOnSelect: true;
  // "Reacted Joy, intensity 75 percent"
  
  // Color blindness
  useShapesNotJustColor: true;
  // Each vector has distinct icon shape
  
  // Motor control
  alternativeInput: {
    // List mode: vertical list instead of radial
    listMode: true;
    // Slider mode: dropdown + slider
    sliderMode: true;
  };
  
  // Motion sensitivity
  reduceMotion: {
    disableRadialAnimation: true;
    disableGlowPulse: true;
  };
}
```

### 4.6 React Native Component Structure

```typescript
// components/VibeWheel/index.tsx
export interface VibeWheelProps {
  onReaction: (vectors: VibeVector) => void;
  onCancel: () => void;
  existingReaction?: VibeVector;
  nodeConfig?: NodeVectorConfig;
  disabled?: boolean;
}

// Internal state
interface VibeWheelState {
  isOpen: boolean;
  currentVectors: VibeVector;
  activeVectorIndex: number | null;
  touchPosition: { x: number; y: number };
  intensity: number;
}

// Subcomponents
// - VibeWheelTrigger: The button that opens the wheel
// - VibeWheelOverlay: The backdrop when wheel is open
// - VibeWheelRadial: The actual wheel with vectors
// - VibeWheelVector: Individual vector segment
// - VibeWheelIntensityRing: Visual intensity indicator
// - VibeWheelHaptics: Haptic feedback controller
```

---

## 5. The Vibe Validator (Feed Algorithm Control)

### 5.1 Conceptual Overview

The Vibe Validator is a UI panel that exposes the feed ranking algorithm's hyperparameters to users. Instead of guessing what you want based on behavior, we let you tell us directly.

**Key Insight:** We're not building transparency theater (showing complex formulas). We're building **Algorithmic Sovereignty**—actual control expressed through intuitive sliders.

### 5.2 The Four Pillars

Every feed score is computed from four weighted dimensions:

```
Final_Score = (Q × Quality) + (R × Recency) + (E × Engagement) + (P × Personalization)

Where Q + R + E + P = 1.0 (weights sum to 100%)
```

| Pillar | What It Controls | User Language |
|--------|------------------|---------------|
| **Quality** | Author reputation, vector quality ratio, statistical confidence | "Show me good stuff from trusted people" |
| **Recency** | Time decay, velocity, freshness | "Show me what's new vs. timeless" |
| **Engagement** | Reaction intensity, discussion depth, shares | "Show me what people are talking about" |
| **Personalization** | Following, vibe alignment, node affinity, trust network | "Show me stuff tailored to me" |

### 5.3 Mode Tiers

The Vibe Validator has four modes of increasing complexity:

#### Mode 1: Simple (90% of users)

Five preset "vibe cards" with no visible sliders:

```typescript
interface SimplePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  weights: {
    quality: number;
    recency: number;
    engagement: number;
    personalization: number;
  };
  specialSettings: Record<string, any>;
}

const SIMPLE_PRESETS: SimplePreset[] = [
  {
    id: 'latest',
    name: '⏰ Latest First',
    icon: '⏰',
    description: 'See what\'s new. Chronological with light quality filtering.',
    weights: { quality: 0.15, recency: 0.65, engagement: 0.10, personalization: 0.10 },
    specialSettings: {
      halfLifeHours: 2,
      minEngagementThreshold: 0,
      chronologicalFallback: true
    }
  },
  {
    id: 'balanced',
    name: '⚖️ Balanced',
    icon: '⚖️',
    description: 'The best of everything. Quality meets relevance.',
    weights: { quality: 0.35, recency: 0.25, engagement: 0.20, personalization: 0.20 },
    specialSettings: {
      halfLifeHours: 12,
      epsilon: 0.10,
      maxPostsPerAuthor: 3
    }
  },
  {
    id: 'hot',
    name: '🔥 What\'s Hot',
    icon: '🔥',
    description: 'Trending content with high engagement right now.',
    weights: { quality: 0.20, recency: 0.25, engagement: 0.45, personalization: 0.10 },
    specialSettings: {
      fireVectorWeight: 3.0,
      velocityBonus: 2.0,
      halfLifeHours: 6,
      crossNodeTrending: 0.15
    }
  },
  {
    id: 'expert',
    name: '💡 Expert Voices',
    icon: '💡',
    description: 'Prioritize high-Cred authors and insightful content.',
    weights: { quality: 0.55, recency: 0.15, engagement: 0.15, personalization: 0.15 },
    specialSettings: {
      insightfulVectorWeight: 4.0,
      minAuthorCred: 200,
      discussionDepthBonus: 2.5,
      halfLifeHours: 48
    }
  },
  {
    id: 'network',
    name: '👥 My Network',
    icon: '👥',
    description: 'Focus on people you follow and your communities.',
    weights: { quality: 0.20, recency: 0.25, engagement: 0.10, personalization: 0.45 },
    specialSettings: {
      followingWeight: 3.0,
      mutualFollowBonus: 1.5,
      supportVectorWeight: 2.5,
      maxTrustDistance: 2
    }
  }
];
```

#### Mode 2: Intermediate (8% of users)

Four macro sliders + quick toggles:

```typescript
interface IntermediateConfig {
  // The four pillars (must sum to 1.0)
  quality: number;      // 0.0 - 1.0
  recency: number;      // 0.0 - 1.0
  engagement: number;   // 0.0 - 1.0
  personalization: number; // 0.0 - 1.0
  
  // Quick settings
  timeRange: '1h' | '6h' | '24h' | '7d' | 'all';
  discoveryRate: number; // 0.0 - 0.30 (epsilon)
  
  // Quick toggles
  hideMutedWords: boolean;
  showSeenPosts: boolean;
  textOnly: boolean;
  mediaOnly: boolean;
  linksOnly: boolean;
  hasDiscussion: boolean; // 5+ comments
}
```

**Slider Behavior:** Adjusting one slider proportionally adjusts others to maintain sum of 1.0.

#### Mode 3: Advanced (1.5% of users)

Expands each pillar into sub-signals:

```typescript
interface AdvancedQualityConfig {
  // Pillar weight (from Intermediate)
  pillarWeight: number; // e.g., 0.35
  
  // Sub-signal weights (must sum to 1.0 within pillar)
  authorCredWeight: number;      // 0.0 - 1.0
  vectorQualityWeight: number;   // 0.0 - 1.0
  confidenceWeight: number;      // 0.0 - 1.0
  
  // Author Cred settings
  minAuthorCred: number;         // 0 - 5000
  credCeiling: number;           // 100 - Infinity
  councilSeatBonus: number;      // 1.0 - 3.0x
  newUserBoost: number;          // 1.0 - 2.0x
  newUserDuration: number;       // 7 - 90 days
  
  // Confidence settings
  wilsonConfidence: number;      // 0.80 - 0.99
  minSamplesForConfidence: number; // 1 - 100
}

interface AdvancedRecencyConfig {
  pillarWeight: number;
  
  timeDecayWeight: number;
  velocityWeight: number;
  freshnessWeight: number;
  
  halfLifeHours: number;         // 1 - 168
  decayFunction: 'exponential' | 'linear' | 'step';
  maxAgeDays: number;            // 1 - 365
  
  velocityWindowHours: number;   // 1 - 24
  velocityMultiplier: number;    // 1.0 - 5.0x
  accelerationBonus: number;     // 0.0 - 2.0x
  
  freshnessDurationMin: number;  // 15 - 240
  freshnessMultiplier: number;   // 1.0 - 3.0x
}

interface AdvancedEngagementConfig {
  pillarWeight: number;
  
  intensityWeight: number;
  discussionWeight: number;
  shareWeight: number;
  
  intensityScale: 'log' | 'linear' | 'sqrt';
  intensityCap: number;          // 100 - 10000
  
  depthMultiplier: number;       // 1.0 - 5.0x
  maxDepthCounted: number;       // 1 - 20
  expertCommentBonus: number;    // 1.0 - 3.0x
  expertCommentThreshold: number; // 100 - 5000 Cred
  
  shareTrustScaling: boolean;
}

interface AdvancedPersonalizationConfig {
  pillarWeight: number;
  
  followingWeight: number;
  alignmentWeight: number;
  affinityWeight: number;
  trustWeight: number;
  
  followingBoost: number;        // 1.0 - 10.0x
  notFollowingBase: number;      // 0.0 - 1.0
  mutualFollowBonus: number;     // 1.0 - 3.0x
  followingOnly: boolean;
  
  alignmentWindowDays: number;   // 7 - 90
  antiAlignmentPenalty: number;  // 0.0 - 1.0x
  
  homeNodeBonus: number;         // 1.0 - 5.0x
  
  maxTrustDistance: number;      // 1 - 6
  trustDecayPerHop: number;      // 0.3 - 0.9x
}

// Vector weight overrides
interface AdvancedVectorConfig {
  insightfulWeight: number;      // 0.0 - 10.0x
  joyWeight: number;
  fireWeight: number;
  supportWeight: number;
  shockWeight: number;
  questionableWeight: number;    // Can be negative: -3.0 to 1.0x
  
  allowNegativeWeights: boolean;
  highCredReactorBonus: boolean;
}
```

#### Mode 4: Expert (0.5% of users)

Full parameter access + custom expressions:

```typescript
interface ExpertConfig extends AdvancedConfig {
  // Custom suppression rules
  suppressionRules: SuppressionRule[];
  
  // Custom boost rules
  boostRules: BoostRule[];
  
  // Network controls
  vouchEnabled: boolean;
  vouchDecayPerHop: number;
  negativeVouchWeight: number;
  
  // Diversity controls
  maxPostsPerAuthor: number;
  authorCooldownPosts: number;
  maxPostsPerNode: number;
  topicClusteringPenalty: number;
  crossNodeMinimum: number;
  
  // Content type targeting
  textTargetRatio: number;
  imageTargetRatio: number;
  videoTargetRatio: number;
  linkTargetRatio: number;
  diversityEnforcement: 'off' | 'soft' | 'hard';
  
  // Exploration
  epsilon: number;               // 0.0 - 0.30
  explorationPool: 'subscribed' | 'all' | 'trending';
  explorationQualityFloor: number;
  newNodeDiscovery: number;
  trendingInjection: number;
  risingAuthorBoost: number;
  
  // Personal experiments
  experiments: UserExperiment[];
  
  // Time-based profiles
  timeProfiles: TimeProfile[];
  
  // Mood toggles
  activeMood: MoodToggle | null;
}

interface SuppressionRule {
  name: string;
  condition: string; // Expression language
  action: 'suppress';
  amount: number;    // 0.0 - 1.0 (percentage reduction)
  enabled: boolean;
}

interface BoostRule {
  name: string;
  condition: string;
  action: 'boost';
  amount: number;    // 1.0 - 5.0 (multiplier)
  enabled: boolean;
}

// Example suppression rule
const hideRageBait: SuppressionRule = {
  name: "Hide Rage Bait",
  condition: `
    (shock_ratio > 0.3 AND questionable_ratio > 0.3)
    AND comment_count > 50
    AND avg_comment_depth < 1.5
  `,
  action: 'suppress',
  amount: 0.80,
  enabled: true
};
```

### 5.4 User Experiments (A/B Testing)

Expert users can run experiments on their own feed:

```typescript
interface UserExperiment {
  id: string;
  userId: string;
  name: string;
  hypothesis: string;
  
  controlConfig: Partial<ExpertConfig>;
  variantConfig: Partial<ExpertConfig>;
  splitRatio: number; // 0.0 - 1.0 (e.g., 0.5 = 50/50)
  
  status: 'running' | 'ended' | 'applied';
  startedAt: Date;
  endedAt?: Date;
  
  metrics: ExperimentMetrics;
  result?: 'control_won' | 'variant_won' | 'inconclusive';
}

interface ExperimentMetrics {
  control: {
    feedLoads: number;
    avgSessionDuration: number;
    avgPostsEngaged: number;
    vibesGiven: Record<string, number>;
    avgScrollDepth: number;
  };
  variant: {
    feedLoads: number;
    avgSessionDuration: number;
    avgPostsEngaged: number;
    vibesGiven: Record<string, number>;
    avgScrollDepth: number;
  };
  statisticalConfidence: number;
}
```

### 5.5 Community Presets (Shareable Algorithms)

```typescript
interface CommunityPreset {
  id: string;
  authorId: string;
  authorName: string;
  
  name: string;
  description: string;
  
  config: ExpertConfig;
  
  // Metrics
  importCount: number;
  ratingSum: number;
  ratingCount: number;
  
  // Discovery
  isFeatured: boolean;
  tags: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

// Users can "subscribe" to another user's algorithm
interface PresetSubscription {
  userId: string;
  presetId: string;
  autoUpdate: boolean; // Sync when preset author updates
  localOverrides: Partial<ExpertConfig>; // User's modifications
}
```

---

## 6. Scoring Engine & Ranking Algorithms

### 6.1 Complete Ranking Formula

```
════════════════════════════════════════════════════════════════════════════
                        FINAL SCORE CALCULATION
════════════════════════════════════════════════════════════════════════════

Final_Score = Base_Score × Suppression_Factor × Diversity_Factor × (1 + Exploration_Factor)

────────────────────────────────────────────────────────────────────────────
BASE SCORE
────────────────────────────────────────────────────────────────────────────

Base_Score = (Q × Quality_Score) + (R × Recency_Score) + (E × Engagement_Score) + (P × Personalization_Score)

Where Q + R + E + P = 1.0

────────────────────────────────────────────────────────────────────────────
QUALITY SCORE (0 to 1)
────────────────────────────────────────────────────────────────────────────

Quality_Score = (cred_w × Author_Cred_Normalized) 
              + (vector_w × Vector_Quality_Ratio) 
              + (wilson_w × Wilson_Confidence)

Author_Cred_Normalized:
  raw_cred = author.nodeCredScores[post.nodeId] || 0
  normalized = min(raw_cred / cred_ceiling, 1.0)
  bonuses = (is_council_seat ? council_bonus : 1.0) × (is_new_user ? new_user_boost : 1.0)
  Author_Cred_Normalized = normalized × bonuses × activity_multiplier

Vector_Quality_Ratio:
  positive_value = (insightful_sum × 3.0) + (support_sum × 2.5) + (joy_sum × 1.5) + (fire_sum × 2.0)
  negative_value = (shock_sum × 0.5) + (questionable_sum × 1.5)
  total_intensity = sum of all vector sums
  Vector_Quality_Ratio = (positive_value - negative_value) / max(total_intensity, 1)
  // Normalize to 0-1 range

Wilson_Confidence:
  // Wilson Score Interval for binomial proportion
  positive_reactions = reactions where (insightful + joy + support + fire) > (shock + questionable)
  total_reactions = all reactions
  p_hat = positive_reactions / total_reactions
  z = 1.96  // 95% confidence
  
  wilson_lower = (p_hat + z²/2n - z × sqrt(p_hat(1-p_hat)/n + z²/4n²)) / (1 + z²/n)
  Wilson_Confidence = wilson_lower

────────────────────────────────────────────────────────────────────────────
RECENCY SCORE (0 to 1)
────────────────────────────────────────────────────────────────────────────

Recency_Score = (decay_w × Time_Decay) + (velocity_w × Velocity) + (fresh_w × Freshness)

Time_Decay:
  hours_since_post = (now - post.createdAt) / 3600000
  lambda = ln(2) / half_life_hours
  
  if decay_function == 'exponential':
    Time_Decay = e^(-lambda × hours_since_post)
  else if decay_function == 'linear':
    Time_Decay = max(0, 1 - (hours_since_post / (half_life_hours × 2)))
  else if decay_function == 'step':
    Time_Decay = hours_since_post < half_life_hours ? 1.0 : 0.0

Velocity:
  reactions_in_window = count reactions in last velocity_window_hours
  avg_reactions = total_reactions / hours_since_post
  velocity_raw = reactions_in_window / max(velocity_window_hours × avg_reactions, 1)
  acceleration = (recent_velocity - older_velocity) > 0 ? acceleration_bonus : 0
  Velocity = min((velocity_raw × velocity_multiplier) + acceleration, 1.0)

Freshness:
  if hours_since_post < (freshness_duration_min / 60):
    Freshness = freshness_multiplier
  else:
    Freshness = 1.0
  // Normalize: Freshness = (Freshness - 1) / (freshness_multiplier - 1)

────────────────────────────────────────────────────────────────────────────
ENGAGEMENT SCORE (0 to 1)
────────────────────────────────────────────────────────────────────────────

Engagement_Score = (int_w × Intensity_Score) + (disc_w × Discussion_Score) + (share_w × Share_Score)

Intensity_Score:
  weighted_intensity = Σ(reaction.totalIntensity × vector_weights[vector] × reactor_cred_bonus)
  
  if intensity_scale == 'log':
    raw_score = log(1 + weighted_intensity)
  else if intensity_scale == 'linear':
    raw_score = weighted_intensity
  else if intensity_scale == 'sqrt':
    raw_score = sqrt(weighted_intensity)
  
  Intensity_Score = min(raw_score / intensity_cap, 1.0)

Discussion_Score:
  comment_count = post.commentCount
  avg_depth = post.avgCommentDepth
  expert_comments = count of comments from users with cred > expert_threshold
  expert_ratio = expert_comments / max(comment_count, 1)
  
  depth_bonus = 1 + (avg_depth × depth_multiplier × 0.1)
  expert_bonus = 1 + (expert_ratio × expert_comment_bonus)
  
  Discussion_Score = min(log(1 + comment_count) × depth_bonus × expert_bonus / 10, 1.0)

Share_Score:
  view_count = max(post.viewCount, 100)
  share_count = post.shareCount
  
  if share_trust_scaling:
    weighted_shares = Σ(share × sharer.trustScore)
    Share_Score = min(weighted_shares / view_count, 1.0)
  else:
    Share_Score = min(share_count / view_count, 1.0)

────────────────────────────────────────────────────────────────────────────
PERSONALIZATION SCORE (0 to 1)
────────────────────────────────────────────────────────────────────────────

Personalization_Score = (fol_w × Following_Score) + (align_w × Alignment_Score) 
                      + (aff_w × Affinity_Score) + (trust_w × Trust_Score)

Following_Score:
  is_following = user.following.includes(post.authorId)
  is_mutual = is_following AND post.author.following.includes(user.id)
  
  if following_only AND NOT is_following:
    return -Infinity  // Exclude from feed entirely
  
  base = is_following ? following_boost : not_following_base
  mutual_mult = is_mutual ? mutual_follow_bonus : 1.0
  Following_Score = min(base × mutual_mult / 10, 1.0)

Alignment_Score:
  user_profile = user.vibeProfile.receivedProfile  // What user tends to like
  post_profile = post.vibeAggregate.normalizedVector
  
  // Cosine similarity
  dot_product = Σ(user_profile[v] × post_profile[v])
  user_magnitude = sqrt(Σ(user_profile[v]²))
  post_magnitude = sqrt(Σ(post_profile[v]²))
  
  similarity = dot_product / (user_magnitude × post_magnitude)
  
  if anti_alignment_penalty > 0 AND similarity < 0:
    Alignment_Score = similarity × anti_alignment_penalty
  else:
    Alignment_Score = (similarity + 1) / 2  // Normalize to 0-1

Affinity_Score:
  user_node_cred = user.nodeCredScores[post.nodeId] || 0
  max_node_cred = getMaxCredInNode(post.nodeId)
  
  base_affinity = user_node_cred / max(max_node_cred, 1)
  is_home_node = user.topNodes[0] == post.nodeId
  home_mult = is_home_node ? home_node_bonus : 1.0
  
  Affinity_Score = min(base_affinity × home_mult, 1.0)

Trust_Score:
  vouch_distance = getVouchDistance(user.id, post.authorId)
  
  if vouch_distance > max_trust_distance:
    Trust_Score = 0
  else:
    Trust_Score = 1 / (1 + vouch_distance × (1 - trust_decay_per_hop))

────────────────────────────────────────────────────────────────────────────
MODIFIERS
────────────────────────────────────────────────────────────────────────────

Suppression_Factor:
  // Product of all triggered suppression rules
  factor = 1.0
  for each rule in suppression_rules:
    if evaluateCondition(rule.condition, post, user):
      factor *= (1 - rule.amount)
  
  // Built-in suppressions
  if post.authorId in user.blockedUsers:
    factor *= (1 - suppress_blocked_rate)
  if post.authorId in user.mutedUsers:
    factor *= (1 - suppress_muted_rate)
  if containsMutedWords(post.content, user.mutedWords):
    factor *= 0  // Complete suppression
  
  Suppression_Factor = factor

Diversity_Factor:
  // Penalize seeing same author/topic repeatedly
  author_penalty = getAuthorRepetitionPenalty(post.authorId, currentFeed)
  topic_penalty = getTopicClusteringPenalty(post.topics, currentFeed)
  
  Diversity_Factor = 1 - author_penalty - topic_penalty

Exploration_Factor:
  // Random injection for serendipity
  if random() < epsilon:
    Exploration_Factor = random() × 0.5  // Up to 50% random boost
  else:
    Exploration_Factor = 0

════════════════════════════════════════════════════════════════════════════
```

### 6.2 TypeScript Implementation

```typescript
interface ScoringParams {
  // Pillar weights
  qualityWeight: number;
  recencyWeight: number;
  engagementWeight: number;
  personalizationWeight: number;
  
  // Quality params
  credWeight: number;
  vectorQualityWeight: number;
  wilsonWeight: number;
  credCeiling: number;
  councilSeatBonus: number;
  newUserBoost: number;
  newUserDurationDays: number;
  
  // Recency params
  timeDecayWeight: number;
  velocityWeight: number;
  freshnessWeight: number;
  halfLifeHours: number;
  decayFunction: 'exponential' | 'linear' | 'step';
  velocityWindowHours: number;
  velocityMultiplier: number;
  accelerationBonus: number;
  freshnessDurationMin: number;
  freshnessMultiplier: number;
  
  // Engagement params
  intensityWeight: number;
  discussionWeight: number;
  shareWeight: number;
  intensityScale: 'log' | 'linear' | 'sqrt';
  intensityCap: number;
  depthMultiplier: number;
  expertCommentBonus: number;
  expertCredThreshold: number;
  shareTrustScaling: boolean;
  
  // Personalization params
  followingWeight: number;
  alignmentWeight: number;
  affinityWeight: number;
  trustWeight: number;
  followingBoost: number;
  notFollowingBase: number;
  mutualFollowBonus: number;
  followingOnly: boolean;
  alignmentWindowDays: number;
  antiAlignmentPenalty: number;
  homeNodeBonus: number;
  maxTrustDistance: number;
  trustDecayPerHop: number;
  
  // Vector weights
  vectorWeights: {
    insightful: number;
    joy: number;
    fire: number;
    support: number;
    shock: number;
    questionable: number;
  };
  
  // Diversity params
  maxPostsPerAuthor: number;
  authorCooldownPosts: number;
  topicClusteringPenalty: number;
  
  // Exploration params
  epsilon: number;
  explorationQualityFloor: number;
  
  // Suppression rules
  suppressionRules: SuppressionRule[];
  boostRules: BoostRule[];
}

function calculatePostScore(
  post: Post,
  user: User,
  currentFeed: Post[],
  params: ScoringParams
): number {
  const qualityScore = calculateQualityScore(post, params);
  const recencyScore = calculateRecencyScore(post, params);
  const engagementScore = calculateEngagementScore(post, params);
  const personalizationScore = calculatePersonalizationScore(post, user, params);
  
  const baseScore = 
    (params.qualityWeight * qualityScore) +
    (params.recencyWeight * recencyScore) +
    (params.engagementWeight * engagementScore) +
    (params.personalizationWeight * personalizationScore);
  
  const suppressionFactor = calculateSuppressionFactor(post, user, params);
  const diversityFactor = calculateDiversityFactor(post, currentFeed, params);
  const explorationFactor = calculateExplorationFactor(params);
  
  return baseScore * suppressionFactor * diversityFactor * (1 + explorationFactor);
}
```

### 6.3 Feed Generation Pipeline

```typescript
interface FeedGenerationPipeline {
  // Step 1: Candidate Generation
  candidatePool: {
    sources: [
      'following',          // Posts from followed users
      'subscribed_nodes',   // Posts from subscribed Nodes
      'trending',           // Platform-wide trending
      'similar_users',      // Collaborative filtering
      'exploration'         // Random quality content
    ];
    poolSize: 500;          // Evaluate up to 500 candidates
    timeout: 200;           // Max 200ms for candidate generation
  };
  
  // Step 2: Scoring
  scoring: {
    parallel: true;         // Score candidates in parallel
    batchSize: 50;          // Process 50 at a time
    cacheScores: true;      // Cache intermediate scores
    cacheTTL: 60;           // Seconds
  };
  
  // Step 3: Re-ranking
  reranking: {
    diversityPass: true;    // Apply diversity constraints
    deduplication: true;    // Remove near-duplicate content
    boostPass: true;        // Apply boost rules
    suppressionPass: true;  // Apply suppression rules
  };
  
  // Step 4: Pagination
  pagination: {
    pageSize: 20;           // Return 20 posts per page
    cursor: string;         // Cursor-based pagination
    prefetchNext: true;     // Pre-compute next page
  };
}
```

---

## 7. Comment Sorting System

### 7.1 Sort Modes

Comments use the same Vibe Vector system, enabling nuanced sorting:

| Sort Mode | Primary Signal | Secondary Signal | Description |
|-----------|---------------|------------------|-------------|
| **Insightful** | 💡 Insightful intensity | Quality score | Best analysis and knowledge |
| **Joyful** | 😄 Joy intensity | Engagement | Funniest and most entertaining |
| **Heated** | 🔥 Fire intensity | Recency | Hot takes and exciting discussion |
| **Supportive** | 💙 Support intensity | Following | Community agreement and empathy |
| **Controversial** | Mixed high-intensity | Discussion depth | Diverse strong reactions |
| **New** | Recency | None | Chronological |
| **Top** | Total positive intensity | Confidence | Overall best (classic) |

### 7.2 Comment Scoring Formula

```typescript
function calculateCommentScore(
  comment: Comment,
  sortMode: SortMode,
  user?: User
): number {
  const vibes = comment.vibeAggregate;
  
  switch (sortMode) {
    case 'insightful':
      return (vibes.insightfulSum * 3.0) + 
             calculateQualityBonus(comment) +
             calculateExpertBonus(comment);
    
    case 'joyful':
      return (vibes.joySum * 2.0) + 
             calculateEngagementBonus(comment);
    
    case 'heated':
      return (vibes.fireSum * 2.0) + 
             calculateRecencyBonus(comment);
    
    case 'supportive':
      return (vibes.supportSum * 2.0) + 
             (user ? calculateNetworkBonus(comment, user) : 0);
    
    case 'controversial':
      return calculateControversyScore(vibes) * 
             calculateDepthBonus(comment);
    
    case 'new':
      return -comment.createdAt.getTime(); // Negative for desc sort
    
    case 'top':
      return calculatePositiveSum(vibes) * 
             calculateWilsonConfidence(vibes);
    
    default:
      return calculatePositiveSum(vibes);
  }
}

function calculateControversyScore(vibes: PostVibeAggregate): number {
  // High controversy = high intensity across multiple vectors
  const values = [
    vibes.insightfulSum,
    vibes.joySum,
    vibes.fireSum,
    vibes.supportSum,
    vibes.shockSum,
    vibes.questionableSum
  ];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // High standard deviation + high total = controversial
  const totalIntensity = vibes.totalIntensity;
  return stdDev * Math.log(1 + totalIntensity);
}

function calculateDepthBonus(comment: Comment): number {
  const avgReplyDepth = comment.avgReplyDepth || 0;
  return 1 + (avgReplyDepth * 0.2);
}

function calculateExpertBonus(comment: Comment): number {
  const expertReplies = comment.replies?.filter(r => r.author.cred > 500).length || 0;
  const totalReplies = comment.replies?.length || 1;
  return 1 + (expertReplies / totalReplies * 0.5);
}
```

### 7.3 Thread Display

```typescript
interface CommentThread {
  rootComment: Comment;
  replies: CommentThread[];
  
  // Display configuration
  collapseThreshold: number;      // Collapse threads with low scores
  loadMoreThreshold: number;      // Show "load more" after N replies
  highlightExperts: boolean;      // Visual indicator for high-Cred users
  sortMode: SortMode;
}
```

---

## 8. Moderation Queue Integration

### 8.1 Automatic Flagging

The Vibe Vector system naturally surfaces content needing review:

```typescript
function calculateFlagScore(post: Post): number {
  const vibes = post.vibeAggregate;
  const totalIntensity = vibes.totalIntensity || 1;
  
  // Calculate ratios
  const questionableRatio = vibes.questionableSum / totalIntensity;
  const shockRatio = vibes.shockSum / totalIntensity;
  
  // Combo signal: users giving BOTH shock AND questionable
  const comboReactors = countComboReactors(post, ['shock', 'questionable']);
  const comboRatio = comboReactors / Math.max(vibes.totalReactors, 1);
  
  // Velocity anomaly: unusual spike in reactions
  const avgHourlyReactions = post.totalReactions / Math.max(getHoursSincePost(post), 1);
  const recentReactions = vibes.reactionsLastHour;
  const velocitySpike = Math.max(0, (recentReactions / Math.max(avgHourlyReactions, 1)) - 2);
  
  // Explicit reports
  const explicitReports = post.reportCount || 0;
  
  // Calculate flag score
  const flagScore = 
    (questionableRatio * 3.0) +
    (shockRatio * 2.0) +
    (comboRatio * 5.0) +
    (velocitySpike * 2.0) +
    (explicitReports * 10.0);
  
  return flagScore;
}
```

### 8.2 Expert Amplification

High-Cred users' negative reactions carry more weight:

```typescript
function getExpertFlagWeight(reactor: User): number {
  // User with 2000 Cred: their Questionable = 2.0x normal weight
  return 1 + (reactor.cred / 1000) * 0.5;
}

function calculateWeightedFlagScore(post: Post): number {
  let weightedScore = 0;
  
  for (const reaction of post.reactions) {
    const weight = getExpertFlagWeight(reaction.user);
    
    if (reaction.vectors.questionable > 0) {
      weightedScore += reaction.vectors.questionable * weight * 3.0;
    }
    if (reaction.vectors.shock > 0) {
      weightedScore += reaction.vectors.shock * weight * 2.0;
    }
  }
  
  return weightedScore + (post.reportCount * 10.0);
}
```

### 8.3 Priority Tiers

| Priority | Flag Score | Response Time Target | Description |
|----------|------------|---------------------|-------------|
| 🔴 Critical | > 50 | < 15 minutes | Likely policy violation |
| 🟠 High | 30-50 | < 1 hour | Needs prompt review |
| 🟡 Medium | 15-30 | < 4 hours | Community concern |
| 🟢 Low | 5-15 | < 24 hours | Minor flags |
| ⚪ Monitor | < 5 | Periodic | Track but no action |

### 8.4 Mod Queue Data Structure

```typescript
interface ModQueueItem {
  id: string;
  postId: string;
  post: Post;
  
  // Scores
  flagScore: number;
  weightedFlagScore: number;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'monitor';
  
  // Breakdown
  questionableRatio: number;
  shockRatio: number;
  comboRatio: number;
  velocitySpike: number;
  reportCount: number;
  
  // Context
  expertFlags: {
    userId: string;
    userName: string;
    userCred: number;
    vectors: VibeVector;
    flaggedAt: Date;
  }[];
  
  // Reports
  reports: {
    userId: string;
    reason: string;
    details?: string;
    reportedAt: Date;
  }[];
  
  // Status
  status: 'pending' | 'reviewing' | 'resolved' | 'escalated';
  assignedTo?: string;
  
  // Timestamps
  createdAt: Date;
  firstFlagAt: Date;
  lastUpdated: Date;
  
  // Resolution
  resolution?: {
    action: 'approved' | 'removed' | 'warned' | 'banned';
    moderatorId: string;
    reason: string;
    resolvedAt: Date;
  };
}
```

### 8.5 Integration with Node Court

When moderation actions are appealed, the Vibe data provides evidence:

```typescript
interface AppealEvidence {
  // Original flag data
  originalFlagScore: number;
  flagBreakdown: {
    questionableRatio: number;
    shockRatio: number;
    expertFlags: number;
    reportCount: number;
  };
  
  // Community reaction summary
  vibeProfile: {
    totalReactors: number;
    positiveRatio: number;  // (insightful + joy + support + fire) / total
    negativeRatio: number;  // (questionable + shock) / total
    avgIntensity: number;
  };
  
  // Expert opinion
  expertReactions: {
    userId: string;
    userCred: number;
    vectors: VibeVector;
    comment?: string;
  }[];
  
  // Moderator reasoning
  moderatorAction: string;
  moderatorReason: string;
}
```

---

## 9. ConnoisseurCred Reputation System

### 9.1 Cred Earning Formula

```typescript
function calculateCredEarned(post: Post): number {
  let credEarned = 0;
  
  for (const reaction of post.reactions) {
    const reactorCred = Math.min(reaction.user.nodeCred || 0, 2000); // Cap at 2x
    const normalizedCred = reactorCred / 1000; // Normalize to ~0-2 range
    
    // Positive vectors earn Cred
    const positiveValue = 
      (reaction.vectors.insightful * 3.0) +
      (reaction.vectors.support * 2.5) +
      (reaction.vectors.joy * 1.5) +
      (reaction.vectors.fire * 2.0);
    
    credEarned += normalizedCred * positiveValue;
  }
  
  return credEarned;
}

function calculateCredLost(post: Post): number {
  let credLost = 0;
  
  for (const reaction of post.reactions) {
    const reactorCred = Math.min(reaction.user.nodeCred || 0, 2000);
    const normalizedCred = reactorCred / 1000;
    
    // Negative vectors lose Cred
    const negativeValue = 
      (reaction.vectors.questionable * 1.5);
    
    // Shock only loses Cred if content was removed
    if (post.status === 'removed') {
      credLost += normalizedCred * (reaction.vectors.shock * 1.0);
    }
    
    credLost += normalizedCred * negativeValue;
  }
  
  // Explicit upheld reports
  if (post.moderationResult === 'removed') {
    credLost += 5.0 * post.reportCount;
  }
  
  return credLost;
}

function updateUserCred(post: Post): void {
  const earned = calculateCredEarned(post);
  const lost = calculateCredLost(post);
  const netChange = earned - lost;
  
  // Update author's Node-specific Cred
  const author = post.author;
  const currentCred = author.nodeCredScores[post.nodeId] || 0;
  const newCred = Math.max(0, currentCred + netChange);
  
  author.nodeCredScores[post.nodeId] = newCred;
  author.totalCred = Object.values(author.nodeCredScores).reduce((a, b) => a + b, 0);
}
```

### 9.2 Activity Multiplier

Base Cred never decays, but governance influence does:

```typescript
function getActivityMultiplier(user: User): number {
  const lastActive = user.lastActivityAt;
  const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceActive <= 7) return 1.0;
  if (daysSinceActive <= 14) return 0.9;
  if (daysSinceActive <= 30) return 0.8;
  if (daysSinceActive <= 60) return 0.7;
  return 0.5;
}

function getActiveCredForGovernance(user: User, nodeId: string): number {
  const baseCred = user.nodeCredScores[nodeId] || 0;
  const multiplier = getActivityMultiplier(user);
  return baseCred * multiplier;
}
```

### 9.3 Cred Display Structure

```typescript
interface UserCredDisplay {
  userId: string;
  username: string;
  
  totalCred: number;
  
  topNodes: {
    nodeId: string;
    nodeName: string;
    cred: number;
    rank?: number;
    badge?: string;
  }[];
  
  topVectorsReceived: {
    vector: string;
    percentage: number;
  }[];
  
  councilSeats: string[]; // Node IDs
  
  vouchStats: {
    vouchedBy: number;
    vouchingFor: number;
  };
  
  activityMultiplier: number;
  activeCred: number;
}
```

---

## 10. Database Schema

### 10.1 Core Tables

```sql
-- Vibe Reactions (the core interaction table)
CREATE TABLE vibe_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    
    -- The 6D vector (stored as individual columns for indexing)
    insightful DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (insightful >= 0 AND insightful <= 1),
    joy DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (joy >= 0 AND joy <= 1),
    fire DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (fire >= 0 AND fire <= 1),
    support DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (support >= 0 AND support <= 1),
    shock DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (shock >= 0 AND shock <= 1),
    questionable DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (questionable >= 0 AND questionable <= 1),
    
    -- Computed total intensity (for quick magnitude queries)
    total_intensity DECIMAL(5,2) GENERATED ALWAYS AS (
        insightful + joy + fire + support + shock + questionable
    ) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, post_id)
);

-- Indexes for reactions
CREATE INDEX idx_reactions_post ON vibe_reactions(post_id);
CREATE INDEX idx_reactions_user ON vibe_reactions(user_id);
CREATE INDEX idx_reactions_created ON vibe_reactions(post_id, created_at DESC);
CREATE INDEX idx_reactions_insightful ON vibe_reactions(post_id, insightful DESC) WHERE insightful > 0;
CREATE INDEX idx_reactions_questionable ON vibe_reactions(post_id, questionable DESC) WHERE questionable > 0;

-- Post Vibe Aggregates (materialized for performance)
CREATE TABLE post_vibe_aggregates (
    post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    
    -- Sums
    insightful_sum DECIMAL(10,2) DEFAULT 0,
    joy_sum DECIMAL(10,2) DEFAULT 0,
    fire_sum DECIMAL(10,2) DEFAULT 0,
    support_sum DECIMAL(10,2) DEFAULT 0,
    shock_sum DECIMAL(10,2) DEFAULT 0,
    questionable_sum DECIMAL(10,2) DEFAULT 0,
    
    -- Counts
    insightful_count INTEGER DEFAULT 0,
    joy_count INTEGER DEFAULT 0,
    fire_count INTEGER DEFAULT 0,
    support_count INTEGER DEFAULT 0,
    shock_count INTEGER DEFAULT 0,
    questionable_count INTEGER DEFAULT 0,
    
    -- Totals
    total_reactors INTEGER DEFAULT 0,
    total_intensity DECIMAL(12,2) DEFAULT 0,
    
    -- Weighted sums (by reactor Cred)
    weighted_insightful DECIMAL(12,2) DEFAULT 0,
    weighted_joy DECIMAL(12,2) DEFAULT 0,
    weighted_fire DECIMAL(12,2) DEFAULT 0,
    weighted_support DECIMAL(12,2) DEFAULT 0,
    weighted_shock DECIMAL(12,2) DEFAULT 0,
    weighted_questionable DECIMAL(12,2) DEFAULT 0,
    
    -- Computed scores
    quality_score DECIMAL(5,4) DEFAULT 0,
    engagement_score DECIMAL(5,4) DEFAULT 0,
    flag_score DECIMAL(8,2) DEFAULT 0,
    
    -- Velocity tracking
    reactions_last_hour INTEGER DEFAULT 0,
    reactions_last_4_hours INTEGER DEFAULT 0,
    
    -- Timestamps
    first_reaction_at TIMESTAMP WITH TIME ZONE,
    last_reaction_at TIMESTAMP WITH TIME ZONE,
    last_aggregated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Vibe Profiles (learned preferences)
CREATE TABLE user_vibe_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- What the user tends to give
    given_insightful DECIMAL(5,4) DEFAULT 0,
    given_joy DECIMAL(5,4) DEFAULT 0,
    given_fire DECIMAL(5,4) DEFAULT 0,
    given_support DECIMAL(5,4) DEFAULT 0,
    given_shock DECIMAL(5,4) DEFAULT 0,
    given_questionable DECIMAL(5,4) DEFAULT 0,
    
    -- What the user tends to like (avg of content they react to)
    received_insightful DECIMAL(5,4) DEFAULT 0,
    received_joy DECIMAL(5,4) DEFAULT 0,
    received_fire DECIMAL(5,4) DEFAULT 0,
    received_support DECIMAL(5,4) DEFAULT 0,
    received_shock DECIMAL(5,4) DEFAULT 0,
    received_questionable DECIMAL(5,4) DEFAULT 0,
    
    -- Stats
    total_reactions_given INTEGER DEFAULT 0,
    profile_window_days INTEGER DEFAULT 30,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Vibe Validator Configs
CREATE TABLE user_vibe_configs (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    mode VARCHAR(20) DEFAULT 'simple' CHECK (mode IN ('simple', 'intermediate', 'advanced', 'expert')),
    active_preset_id VARCHAR(100) DEFAULT 'balanced',
    
    -- Full config stored as JSONB for flexibility
    config JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Saved Presets
CREATE TABLE user_vibe_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    
    is_active BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Community Shared Presets
CREATE TABLE community_vibe_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    
    import_count INTEGER DEFAULT 0,
    rating_sum INTEGER DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    
    is_featured BOOLEAN DEFAULT FALSE,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_community_presets_rating ON community_vibe_presets(
    (rating_sum::FLOAT / GREATEST(rating_count, 1)) DESC
);
CREATE INDEX idx_community_presets_imports ON community_vibe_presets(import_count DESC);

-- User Experiments
CREATE TABLE user_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    hypothesis TEXT,
    
    control_config JSONB NOT NULL,
    variant_config JSONB NOT NULL,
    split_ratio DECIMAL(3,2) DEFAULT 0.50,
    
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'ended', 'applied')),
    result VARCHAR(20) CHECK (result IN ('control_won', 'variant_won', 'inconclusive')),
    
    metrics JSONB DEFAULT '{}',
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Experiment Metrics (per feed load)
CREATE TABLE experiment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES user_experiments(id) ON DELETE CASCADE,
    
    variant VARCHAR(20) NOT NULL CHECK (variant IN ('control', 'variant')),
    
    session_duration_seconds INTEGER,
    posts_engaged INTEGER,
    vibes_given JSONB,
    scroll_depth INTEGER,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time-Based Profiles
CREATE TABLE user_time_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INTEGER NOT NULL CHECK (end_hour >= 0 AND end_hour <= 23),
    
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Node Vector Customization
CREATE TABLE node_vector_configs (
    node_id UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    
    vector_labels JSONB NOT NULL DEFAULT '{
        "insightful": {"label": "Insightful", "icon": "💡"},
        "joy": {"label": "Joy", "icon": "😄"},
        "fire": {"label": "Fire", "icon": "🔥"},
        "support": {"label": "Support", "icon": "💙"},
        "shock": {"label": "Shock", "icon": "😱"},
        "questionable": {"label": "Questionable", "icon": "🤔"}
    }',
    
    disabled_vectors TEXT[] DEFAULT '{}',
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation Queue
CREATE TABLE mod_queue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES nodes(id),
    
    flag_score DECIMAL(8,2) NOT NULL,
    weighted_flag_score DECIMAL(8,2) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low', 'monitor')),
    
    -- Breakdown
    questionable_ratio DECIMAL(5,4),
    shock_ratio DECIMAL(5,4),
    combo_ratio DECIMAL(5,4),
    velocity_spike DECIMAL(8,2),
    report_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'escalated')),
    assigned_to UUID REFERENCES users(id),
    
    -- Resolution
    resolution_action VARCHAR(20),
    resolution_reason TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_flag_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mod_queue_priority ON mod_queue_items(node_id, priority, created_at) WHERE status = 'pending';
CREATE INDEX idx_mod_queue_assigned ON mod_queue_items(assigned_to) WHERE status = 'reviewing';

-- Expert Flags (for audit trail)
CREATE TABLE expert_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mod_queue_item_id UUID NOT NULL REFERENCES mod_queue_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    user_cred INTEGER NOT NULL,
    
    vectors JSONB NOT NULL,
    
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 10.2 Materialized View for Feed Ranking

```sql
-- Materialized view for fast feed queries
CREATE MATERIALIZED VIEW feed_candidates AS
SELECT 
    p.id AS post_id,
    p.author_id,
    p.node_id,
    p.created_at,
    p.content_type,
    
    -- Author info
    u.username AS author_username,
    COALESCE(unc.cred, 0) AS author_node_cred,
    
    -- Vibe aggregates
    pva.total_reactors,
    pva.total_intensity,
    pva.quality_score,
    pva.engagement_score,
    pva.flag_score,
    
    -- Individual vector sums (for filtering)
    pva.insightful_sum,
    pva.joy_sum,
    pva.fire_sum,
    pva.support_sum,
    pva.shock_sum,
    pva.questionable_sum,
    
    -- Velocity
    pva.reactions_last_hour,
    pva.reactions_last_4_hours,
    
    -- Time calculations
    EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 AS hours_since_post,
    
    -- Comment stats
    p.comment_count,
    p.avg_comment_depth
    
FROM posts p
JOIN users u ON p.author_id = u.id
LEFT JOIN post_vibe_aggregates pva ON p.id = pva.post_id
LEFT JOIN user_node_cred unc ON p.author_id = unc.user_id AND p.node_id = unc.node_id
WHERE p.status = 'published'
  AND p.created_at > NOW() - INTERVAL '7 days';

CREATE UNIQUE INDEX idx_feed_candidates_post ON feed_candidates(post_id);
CREATE INDEX idx_feed_candidates_node ON feed_candidates(node_id, quality_score DESC);
CREATE INDEX idx_feed_candidates_author ON feed_candidates(author_id);
CREATE INDEX idx_feed_candidates_trending ON feed_candidates(reactions_last_hour DESC);

-- Refresh strategy: every 5 minutes via BullMQ job
-- REFRESH MATERIALIZED VIEW CONCURRENTLY feed_candidates;
```

---

## 11. API Endpoints

### 11.1 Reactions API

```typescript
// POST /api/v1/posts/:postId/reactions
interface CreateReactionRequest {
  vectors: {
    insightful?: number;  // 0.0 - 1.0
    joy?: number;
    fire?: number;
    support?: number;
    shock?: number;
    questionable?: number;
  };
}

interface CreateReactionResponse {
  reaction: {
    id: string;
    userId: string;
    postId: string;
    vectors: VibeVector;
    createdAt: string;
  };
  postAggregate: {
    totalReactors: number;
    topVectors: { vector: string; sum: number }[];
  };
}

// PUT /api/v1/posts/:postId/reactions
// Same as POST, updates existing reaction

// DELETE /api/v1/posts/:postId/reactions
// Removes user's reaction

// GET /api/v1/posts/:postId/reactions
interface GetReactionsResponse {
  reactions: {
    user: { id: string; username: string; cred: number };
    vectors: VibeVector;
    createdAt: string;
  }[];
  aggregate: PostVibeAggregate;
  userReaction?: VibeVector; // If authenticated user has reacted
}
```

### 11.2 Vibe Validator API

```typescript
// GET /api/v1/vibe-config
interface GetVibeConfigResponse {
  mode: 'simple' | 'intermediate' | 'advanced' | 'expert';
  activePresetId: string;
  config: ScoringParams;
  presets: SimplePreset[];
}

// PUT /api/v1/vibe-config
interface UpdateVibeConfigRequest {
  mode?: 'simple' | 'intermediate' | 'advanced' | 'expert';
  activePresetId?: string;
  config?: Partial<ScoringParams>;
}

// GET /api/v1/vibe-config/presets
interface GetPresetsResponse {
  system: SimplePreset[];
  user: UserPreset[];
  subscriptions: { preset: CommunityPreset; localOverrides: Partial<ScoringParams> }[];
}

// POST /api/v1/vibe-config/presets
interface CreatePresetRequest {
  name: string;
  description?: string;
  config: ScoringParams;
}

// GET /api/v1/vibe-config/community-presets
interface GetCommunityPresetsRequest {
  sort: 'rating' | 'imports' | 'recent';
  tags?: string[];
  limit?: number;
  cursor?: string;
}

// POST /api/v1/vibe-config/community-presets/:presetId/import
// Imports a community preset to user's presets

// POST /api/v1/vibe-config/experiments
interface CreateExperimentRequest {
  name: string;
  hypothesis?: string;
  controlConfig: Partial<ScoringParams>;
  variantConfig: Partial<ScoringParams>;
  splitRatio?: number;
}

// POST /api/v1/vibe-config/experiments/:experimentId/end
interface EndExperimentRequest {
  action: 'apply_control' | 'apply_variant' | 'discard';
}
```

### 11.3 Feed API

```typescript
// GET /api/v1/feed
interface GetFeedRequest {
  // Pagination
  cursor?: string;
  limit?: number;  // Default 20
  
  // Filtering
  nodeId?: string;
  authorId?: string;
  
  // Time range
  after?: string;  // ISO date
  before?: string;
  
  // Override preset (for preview)
  presetOverride?: string;
}

interface GetFeedResponse {
  posts: {
    post: Post;
    author: User;
    node: Node;
    vibeAggregate: PostVibeAggregate;
    userReaction?: VibeVector;
    score: number;  // For debugging/transparency
    scoreBreakdown?: {
      quality: number;
      recency: number;
      engagement: number;
      personalization: number;
    };
  }[];
  
  cursor: string;
  hasMore: boolean;
  
  // Feed metadata
  meta: {
    preset: string;
    mode: string;
    candidatesEvaluated: number;
    computeTimeMs: number;
  };
}

// GET /api/v1/feed/explain/:postId
// Returns detailed scoring breakdown for a specific post
interface ExplainPostResponse {
  post: Post;
  score: number;
  
  breakdown: {
    quality: {
      value: number;
      weight: number;
      factors: {
        authorCred: number;
        vectorQuality: number;
        confidence: number;
      };
    };
    recency: {
      value: number;
      weight: number;
      factors: {
        timeDecay: number;
        velocity: number;
        freshness: number;
      };
    };
    engagement: {
      value: number;
      weight: number;
      factors: {
        intensity: number;
        discussion: number;
        shares: number;
      };
    };
    personalization: {
      value: number;
      weight: number;
      factors: {
        following: number;
        alignment: number;
        affinity: number;
        trust: number;
      };
    };
  };
  
  modifiers: {
    suppressionFactor: number;
    diversityFactor: number;
    explorationFactor: number;
    appliedRules: string[];
  };
}
```

### 11.4 Node Vector Config API

```typescript
// GET /api/v1/nodes/:nodeId/vector-config
interface GetNodeVectorConfigResponse {
  nodeId: string;
  vectorLabels: {
    insightful: { label: string; icon: string };
    joy: { label: string; icon: string };
    fire: { label: string; icon: string };
    support: { label: string; icon: string };
    shock: { label: string; icon: string };
    questionable: { label: string; icon: string };
  };
  disabledVectors: string[];
}

// PUT /api/v1/nodes/:nodeId/vector-config (Council members only)
interface UpdateNodeVectorConfigRequest {
  vectorLabels?: {
    insightful?: { label: string; icon: string };
    joy?: { label: string; icon: string };
    fire?: { label: string; icon: string };
    support?: { label: string; icon: string };
    shock?: { label: string; icon: string };
    questionable?: { label: string; icon: string };
  };
  disabledVectors?: string[];
}
```

---

## 12. Frontend Implementation Guide

### 12.1 React Native Component Hierarchy

```
app/
├── (tabs)/
│   ├── _layout.tsx           # Tab navigation
│   ├── index.tsx             # Home feed
│   ├── search.tsx            # Search/discovery
│   ├── create.tsx            # Create post
│   ├── notifications.tsx     # Notifications
│   └── profile.tsx           # User profile
│
├── post/
│   └── [id].tsx              # Post detail with comments
│
├── vibe-validator/
│   ├── _layout.tsx           # Vibe Validator modal
│   ├── simple.tsx            # Preset cards
│   ├── intermediate.tsx      # 4-slider view
│   ├── advanced.tsx          # Sub-signal tuning
│   └── expert.tsx            # Full parameter access
│
└── components/
    ├── vibe/
    │   ├── RadialWheel/
    │   │   ├── index.tsx
    │   │   ├── WheelOverlay.tsx
    │   │   ├── VectorSegment.tsx
    │   │   ├── IntensityRing.tsx
    │   │   └── useWheelGestures.ts
    │   │
    │   ├── VibeDisplay/
    │   │   ├── index.tsx
    │   │   ├── HaloRing.tsx      # Aggregate display
    │   │   ├── VectorBreakdown.tsx
    │   │   └── IntensityGlow.tsx
    │   │
    │   ├── VibeValidator/
    │   │   ├── index.tsx
    │   │   ├── PresetCard.tsx
    │   │   ├── PillarSlider.tsx
    │   │   ├── SubSignalPanel.tsx
    │   │   ├── VectorWeightSlider.tsx
    │   │   ├── SuppressionRuleEditor.tsx
    │   │   └── ExperimentPanel.tsx
    │   │
    │   └── QuickReaction/
    │       ├── index.tsx
    │       ├── ReactionButton.tsx
    │       └── SwipeReaction.tsx
    │
    ├── feed/
    │   ├── FeedList.tsx
    │   ├── PostCard.tsx
    │   ├── PostVibes.tsx
    │   └── ScoreDebug.tsx    # Optional transparency
    │
    └── comments/
        ├── CommentThread.tsx
        ├── CommentCard.tsx
        ├── SortSelector.tsx
        └── CommentVibes.tsx
```

### 12.2 State Management (Zustand)

```typescript
// stores/vibeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VibeState {
  // User's vibe config
  mode: 'simple' | 'intermediate' | 'advanced' | 'expert';
  activePresetId: string;
  config: ScoringParams;
  
  // Cached reactions (optimistic updates)
  userReactions: Map<string, VibeVector>;
  
  // UI state
  isWheelOpen: boolean;
  activePostId: string | null;
  pendingReaction: VibeVector | null;
  
  // Actions
  setMode: (mode: VibeState['mode']) => void;
  setActivePreset: (presetId: string) => void;
  updateConfig: (partial: Partial<ScoringParams>) => void;
  
  openWheel: (postId: string) => void;
  closeWheel: () => void;
  setPendingReaction: (vectors: VibeVector | null) => void;
  
  addReaction: (postId: string, vectors: VibeVector) => void;
  removeReaction: (postId: string) => void;
}

export const useVibeStore = create<VibeState>()(
  persist(
    (set, get) => ({
      mode: 'simple',
      activePresetId: 'balanced',
      config: DEFAULT_SCORING_PARAMS,
      userReactions: new Map(),
      isWheelOpen: false,
      activePostId: null,
      pendingReaction: null,
      
      setMode: (mode) => set({ mode }),
      setActivePreset: (presetId) => set({ activePresetId: presetId }),
      updateConfig: (partial) => set((state) => ({
        config: { ...state.config, ...partial }
      })),
      
      openWheel: (postId) => set({ isWheelOpen: true, activePostId: postId }),
      closeWheel: () => set({ isWheelOpen: false, activePostId: null, pendingReaction: null }),
      setPendingReaction: (vectors) => set({ pendingReaction: vectors }),
      
      addReaction: (postId, vectors) => set((state) => {
        const newReactions = new Map(state.userReactions);
        newReactions.set(postId, vectors);
        return { userReactions: newReactions };
      }),
      removeReaction: (postId) => set((state) => {
        const newReactions = new Map(state.userReactions);
        newReactions.delete(postId);
        return { userReactions: newReactions };
      }),
    }),
    {
      name: 'vibe-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        activePresetId: state.activePresetId,
        config: state.config,
      }),
    }
  )
);
```

### 12.3 TanStack Query Integration

```typescript
// queries/vibeQueries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch user's vibe config
export function useVibeConfig() {
  return useQuery({
    queryKey: ['vibeConfig'],
    queryFn: async () => {
      const response = await api.get('/vibe-config');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Update vibe config
export function useUpdateVibeConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: Partial<ScoringParams>) => {
      return api.put('/vibe-config', { config });
    },
    onSuccess: () => {
      // Invalidate feed to refetch with new config
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['vibeConfig'] });
    },
  });
}

// Create/update reaction
export function useReaction(postId: string) {
  const queryClient = useQueryClient();
  const vibeStore = useVibeStore();
  
  return useMutation({
    mutationFn: async (vectors: VibeVector) => {
      return api.post(`/posts/${postId}/reactions`, { vectors });
    },
    onMutate: async (vectors) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      
      const previousPost = queryClient.getQueryData(['post', postId]);
      vibeStore.addReaction(postId, vectors);
      
      return { previousPost };
    },
    onError: (err, vectors, context) => {
      // Rollback
      if (context?.previousPost) {
        queryClient.setQueryData(['post', postId], context.previousPost);
      }
      vibeStore.removeReaction(postId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}

// Infinite scroll feed
export function useFeed(nodeId?: string) {
  const { config, activePresetId } = useVibeStore();
  
  return useInfiniteQuery({
    queryKey: ['feed', nodeId, activePresetId, config],
    queryFn: async ({ pageParam }) => {
      const response = await api.get('/feed', {
        params: {
          cursor: pageParam,
          nodeId,
          limit: 20,
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => 
      lastPage.hasMore ? lastPage.cursor : undefined,
    staleTime: 60 * 1000, // 1 minute
  });
}
```

### 12.4 Radial Wheel Implementation

```typescript
// components/vibe/RadialWheel/index.tsx
import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { VectorSegment } from './VectorSegment';
import { IntensityRing } from './IntensityRing';
import { VECTOR_COLORS, VECTOR_ICONS, VECTORS } from '@/constants/vibes';

interface RadialWheelProps {
  onReaction: (vectors: VibeVector) => void;
  onCancel: () => void;
  existingReaction?: VibeVector;
  nodeConfig?: NodeVectorConfig;
  position: { x: number; y: number };
}

const WHEEL_RADIUS = 120;
const VECTOR_ANGLE_SPACING = 60; // degrees

export function RadialWheel({
  onReaction,
  onCancel,
  existingReaction,
  nodeConfig,
  position,
}: RadialWheelProps) {
  // Shared values for animations
  const scale = useSharedValue(0);
  const activeVector = useSharedValue<number | null>(null);
  const intensity = useSharedValue(0);
  const vectors = useSharedValue<VibeVector>({
    insightful: 0, joy: 0, fire: 0, support: 0, shock: 0, questionable: 0
  });
  
  // Animation on mount
  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    
    if (existingReaction) {
      vectors.value = existingReaction;
    }
  }, []);
  
  // Calculate which vector segment is active based on angle
  const getVectorFromAngle = useCallback((angle: number): keyof VibeVector => {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const index = Math.floor(normalizedAngle / VECTOR_ANGLE_SPACING);
    return VECTORS[index];
  }, []);
  
  // Calculate intensity from distance (0 at center, 1 at edge)
  const getIntensityFromDistance = useCallback((distance: number): number => {
    return Math.min(distance / WHEEL_RADIUS, 1);
  }, []);
  
  // Haptic feedback
  const triggerHaptic = useCallback((level: number) => {
    'worklet';
    if (level === 0.25 || level === 0.5 || level === 0.75) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    } else if (level === 1) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, []);
  
  // Pan gesture for selecting vectors and intensity
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      // Calculate initial position relative to center
    })
    .onUpdate((event) => {
      const dx = event.x - WHEEL_RADIUS;
      const dy = event.y - WHEEL_RADIUS;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      
      // Determine active vector
      const vector = getVectorFromAngle(angle);
      const vectorIndex = VECTORS.indexOf(vector);
      
      if (activeVector.value !== vectorIndex) {
        activeVector.value = vectorIndex;
        runOnJS(Haptics.selectionAsync)();
      }
      
      // Calculate intensity
      const newIntensity = getIntensityFromDistance(distance);
      
      // Haptic feedback at thresholds
      const oldQuarter = Math.floor(intensity.value * 4);
      const newQuarter = Math.floor(newIntensity * 4);
      if (newQuarter !== oldQuarter && newQuarter > 0) {
        triggerHaptic(newQuarter * 0.25);
      }
      
      intensity.value = newIntensity;
      
      // Update vectors
      vectors.value = {
        ...vectors.value,
        [vector]: Math.round(newIntensity * 100) / 100,
      };
    })
    .onEnd(() => {
      // Commit reaction
      const finalVectors = vectors.value;
      const hasReaction = Object.values(finalVectors).some(v => v > 0);
      
      if (hasReaction) {
        runOnJS(onReaction)(finalVectors);
      } else {
        runOnJS(onCancel)();
      }
    });
  
  // Tap outside to cancel
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      scale.value = withSpring(0);
      runOnJS(onCancel)();
    });
  
  // Animated styles
  const wheelStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
    ],
    opacity: scale.value,
  }));
  
  return (
    <GestureDetector gesture={Gesture.Exclusive(panGesture, tapGesture)}>
      <View style={[styles.container, { left: position.x, top: position.y }]}>
        <Animated.View style={[styles.wheel, wheelStyle]}>
          {/* Center point */}
          <View style={styles.center} />
          
          {/* Vector segments */}
          {VECTORS.map((vector, index) => (
            <VectorSegment
              key={vector}
              vector={vector}
              index={index}
              activeVector={activeVector}
              intensity={vectors.value[vector]}
              color={VECTOR_COLORS[vector]}
              icon={nodeConfig?.vectorLabels?.[vector]?.icon || VECTOR_ICONS[vector]}
              label={nodeConfig?.vectorLabels?.[vector]?.label || vector}
            />
          ))}
          
          {/* Intensity ring */}
          <IntensityRing intensity={intensity} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: WHEEL_RADIUS * 2,
    height: WHEEL_RADIUS * 2,
    marginLeft: -WHEEL_RADIUS,
    marginTop: -WHEEL_RADIUS,
  },
  wheel: {
    width: '100%',
    height: '100%',
    borderRadius: WHEEL_RADIUS,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    position: 'absolute',
  },
});
```

### 12.5 Vibe Validator Panel

```typescript
// components/vibe/VibeValidator/index.tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useVibeStore } from '@/stores/vibeStore';

import { PresetCard } from './PresetCard';
import { PillarSlider } from './PillarSlider';
import { SubSignalPanel } from './SubSignalPanel';
import { ExpertPanel } from './ExpertPanel';

export function VibeValidator() {
  const { mode, config, setMode, updateConfig } = useVibeStore();
  
  return (
    <ScrollView style={styles.container}>
      {/* Mode selector */}
      <ModeSelector value={mode} onChange={setMode} />
      
      {mode === 'simple' && (
        <SimpleMode />
      )}
      
      {mode === 'intermediate' && (
        <IntermediateMode config={config} updateConfig={updateConfig} />
      )}
      
      {mode === 'advanced' && (
        <AdvancedMode config={config} updateConfig={updateConfig} />
      )}
      
      {mode === 'expert' && (
        <ExpertMode config={config} updateConfig={updateConfig} />
      )}
    </ScrollView>
  );
}

function SimpleMode() {
  const { activePresetId, setActivePreset } = useVibeStore();
  
  return (
    <View style={styles.presetsContainer}>
      {SIMPLE_PRESETS.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          isActive={activePresetId === preset.id}
          onSelect={() => setActivePreset(preset.id)}
        />
      ))}
    </View>
  );
}

function IntermediateMode({ config, updateConfig }) {
  // Normalize weights to sum to 1.0
  const normalizeWeights = (key: string, value: number) => {
    const others = ['qualityWeight', 'recencyWeight', 'engagementWeight', 'personalizationWeight']
      .filter(k => k !== key);
    
    const remaining = 1 - value;
    const currentOtherSum = others.reduce((sum, k) => sum + config[k], 0);
    
    const newConfig = { [key]: value };
    others.forEach(k => {
      newConfig[k] = currentOtherSum > 0 
        ? config[k] / currentOtherSum * remaining 
        : remaining / others.length;
    });
    
    updateConfig(newConfig);
  };
  
  return (
    <View>
      <PillarSlider
        label="Quality"
        description="Prioritize well-regarded content from trusted contributors"
        value={config.qualityWeight}
        onChange={(v) => normalizeWeights('qualityWeight', v)}
        color="#00BFFF"
      />
      <PillarSlider
        label="Recency"
        description="Show newer posts over older ones"
        value={config.recencyWeight}
        onChange={(v) => normalizeWeights('recencyWeight', v)}
        color="#32CD32"
      />
      <PillarSlider
        label="Engagement"
        description="Boost posts with more reactions and discussion"
        value={config.engagementWeight}
        onChange={(v) => normalizeWeights('engagementWeight', v)}
        color="#FF4500"
      />
      <PillarSlider
        label="Personalization"
        description="Tailor feed to your interests and network"
        value={config.personalizationWeight}
        onChange={(v) => normalizeWeights('personalizationWeight', v)}
        color="#FF69B4"
      />
      
      {/* Quick settings */}
      <TimeRangeSelector value={config.timeRange} onChange={(v) => updateConfig({ timeRange: v })} />
      <DiscoverySlider value={config.epsilon} onChange={(v) => updateConfig({ epsilon: v })} />
    </View>
  );
}
```

---

## 13. Performance & Infrastructure

### 13.1 Caching Strategy

```typescript
// Redis cache structure
interface CacheKeys {
  // Post aggregate scores (TTL: 60s)
  postAggregate: `post:${string}:aggregate`;
  
  // User vibe profile (TTL: 5m)
  userProfile: `user:${string}:vibe-profile`;
  
  // Feed candidates (TTL: 60s)
  feedCandidates: `feed:${string}:candidates`;
  
  // Precomputed scores for user+post (TTL: 60s)
  userPostScore: `score:${string}:${string}`;
  
  // Trending posts (TTL: 5m)
  trending: `trending:${string}`; // nodeId or 'global'
}

// Cache warming strategy
async function warmFeedCache(userId: string): Promise<void> {
  const user = await getUser(userId);
  const subscribedNodes = user.subscribedNodes;
  
  // Pre-compute scores for likely candidates
  const candidates = await generateCandidates(userId, subscribedNodes);
  const scores = await Promise.all(
    candidates.map(post => calculatePostScore(post, user))
  );
  
  // Cache the results
  await redis.setex(
    `feed:${userId}:candidates`,
    60,
    JSON.stringify(candidates.map((post, i) => ({ ...post, score: scores[i] })))
  );
}
```

### 13.2 Background Jobs (BullMQ)

```typescript
// jobs/aggregateVibes.ts
import { Queue, Worker } from 'bullmq';

const aggregateQueue = new Queue('aggregate-vibes');

// Triggered on new reaction
export async function queueAggregateJob(postId: string): Promise<void> {
  await aggregateQueue.add('aggregate', { postId }, {
    delay: 1000, // Debounce: wait 1s for more reactions
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

// Worker
const aggregateWorker = new Worker('aggregate-vibes', async (job) => {
  const { postId } = job.data;
  
  // Recalculate aggregates
  const reactions = await db.vibeReactions.findMany({ where: { postId } });
  const aggregate = calculateAggregate(reactions);
  
  await db.postVibeAggregates.upsert({
    where: { postId },
    create: { postId, ...aggregate },
    update: aggregate,
  });
  
  // Update flag score for mod queue
  if (aggregate.flagScore > 5) {
    await updateModQueue(postId, aggregate.flagScore);
  }
  
  // Invalidate cache
  await redis.del(`post:${postId}:aggregate`);
});

// jobs/updateCredScores.ts
const credQueue = new Queue('update-cred');

// Run hourly
export async function scheduleCredUpdates(): Promise<void> {
  await credQueue.add('batch-update', {}, {
    repeat: { pattern: '0 * * * *' }, // Every hour
  });
}

const credWorker = new Worker('update-cred', async (job) => {
  // Get posts from last hour with reactions
  const recentPosts = await db.posts.findMany({
    where: {
      vibeAggregate: {
        lastReactionAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    },
    include: {
      author: true,
      vibeAggregate: true,
    },
  });
  
  // Update Cred for each author
  for (const post of recentPosts) {
    const earned = calculateCredEarned(post);
    const lost = calculateCredLost(post);
    
    await db.userNodeCred.upsert({
      where: {
        userId_nodeId: {
          userId: post.authorId,
          nodeId: post.nodeId,
        },
      },
      create: {
        userId: post.authorId,
        nodeId: post.nodeId,
        cred: earned - lost,
      },
      update: {
        cred: {
          increment: earned - lost,
        },
      },
    });
  }
});

// jobs/refreshFeedCandidates.ts
const feedQueue = new Queue('refresh-feed');

// Run every 5 minutes
const feedWorker = new Worker('refresh-feed', async (job) => {
  // Refresh materialized view
  await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY feed_candidates`;
});
```

### 13.3 Vector Search Setup

```typescript
// For similarity-based recommendations using pgvector
// or MeiliSearch for full-text + vector hybrid

// pgvector setup
await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;

await db.$executeRaw`
  ALTER TABLE user_vibe_profiles 
  ADD COLUMN IF NOT EXISTS received_vector vector(6)
  GENERATED ALWAYS AS (
    ARRAY[received_insightful, received_joy, received_fire, 
          received_support, received_shock, received_questionable]::vector
  ) STORED
`;

await db.$executeRaw`
  ALTER TABLE post_vibe_aggregates 
  ADD COLUMN IF NOT EXISTS normalized_vector vector(6)
`;

// Similarity query
async function findSimilarPosts(userProfile: VibeVector, limit: number = 100): Promise<Post[]> {
  const vectorString = `[${Object.values(userProfile).join(',')}]`;
  
  return db.$queryRaw`
    SELECT p.*, 
           1 - (pva.normalized_vector <=> ${vectorString}::vector) as similarity
    FROM posts p
    JOIN post_vibe_aggregates pva ON p.id = pva.post_id
    WHERE p.status = 'published'
      AND p.created_at > NOW() - INTERVAL '7 days'
    ORDER BY pva.normalized_vector <=> ${vectorString}::vector
    LIMIT ${limit}
  `;
}
```

---

## 14. Anti-Gaming & Sybil Resistance

### 14.1 Trust Score (EigenTrust-like)

```typescript
interface TrustScoreParams {
  // Seed nodes (manually trusted accounts)
  seedNodes: string[];
  
  // Iterations for convergence
  maxIterations: number;
  convergenceThreshold: number;
  
  // Decay factor
  alpha: number; // 0.85 typical
}

async function calculateTrustScores(params: TrustScoreParams): Promise<Map<string, number>> {
  const users = await db.users.findMany();
  const vouches = await db.vouches.findMany({ where: { active: true } });
  
  // Initialize trust scores
  const trustScores = new Map<string, number>();
  users.forEach(u => trustScores.set(u.id, params.seedNodes.includes(u.id) ? 1.0 : 0.1));
  
  // Build vouch graph
  const vouchGraph = new Map<string, string[]>();
  vouches.forEach(v => {
    const existing = vouchGraph.get(v.voucherId) || [];
    existing.push(v.voucheeId);
    vouchGraph.set(v.voucherId, existing);
  });
  
  // Iterate until convergence
  for (let i = 0; i < params.maxIterations; i++) {
    const newScores = new Map<string, number>();
    let maxDelta = 0;
    
    for (const [userId, score] of trustScores) {
      // Trust flows from vouchers
      const vouchers = vouches.filter(v => v.voucheeId === userId);
      let incomingTrust = 0;
      
      for (const vouch of vouchers) {
        const voucherScore = trustScores.get(vouch.voucherId) || 0;
        const voucherOutDegree = vouchGraph.get(vouch.voucherId)?.length || 1;
        incomingTrust += voucherScore / voucherOutDegree;
      }
      
      // Damping factor
      const newScore = (1 - params.alpha) / users.length + params.alpha * incomingTrust;
      newScores.set(userId, newScore);
      
      maxDelta = Math.max(maxDelta, Math.abs(newScore - score));
    }
    
    trustScores.clear();
    newScores.forEach((v, k) => trustScores.set(k, v));
    
    if (maxDelta < params.convergenceThreshold) break;
  }
  
  return trustScores;
}
```

### 14.2 Reaction Impact Weighting

```typescript
function calculateReactionImpact(
  reaction: VibeReaction,
  reactor: User,
  trustScores: Map<string, number>
): VibeVector {
  const trustScore = trustScores.get(reactor.id) || 0.1;
  const credMultiplier = Math.min(reactor.cred / 1000, 2.0);
  
  // Low trust = low impact
  const impactMultiplier = trustScore * credMultiplier;
  
  return {
    insightful: reaction.vectors.insightful * impactMultiplier,
    joy: reaction.vectors.joy * impactMultiplier,
    fire: reaction.vectors.fire * impactMultiplier,
    support: reaction.vectors.support * impactMultiplier,
    shock: reaction.vectors.shock * impactMultiplier,
    questionable: reaction.vectors.questionable * impactMultiplier,
  };
}
```

### 14.3 Rate Limiting

```typescript
// Per-user rate limits
const RATE_LIMITS = {
  reactions: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Max 30 reactions per minute
  },
  highIntensityReactions: {
    windowMs: 60 * 1000,
    max: 10, // Max 10 high-intensity (>80%) reactions per minute
  },
  questionableReactions: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Max 50 questionable reactions per hour
  },
};

// Anomaly detection
interface AnomalyFlags {
  // User giving same reaction pattern repeatedly
  repetitivePattern: boolean;
  
  // User reacting to same author repeatedly (negative or positive)
  targetedBehavior: boolean;
  
  // Unusual velocity spike
  velocityAnomaly: boolean;
  
  // New account with high volume
  newAccountHighVolume: boolean;
}

async function detectAnomalies(userId: string): Promise<AnomalyFlags> {
  const recentReactions = await db.vibeReactions.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    include: { post: true },
  });
  
  // Check for repetitive patterns
  const vectorPatterns = recentReactions.map(r => 
    JSON.stringify(Object.entries(r.vectors).filter(([k, v]) => v > 0.5).map(([k]) => k).sort())
  );
  const mostCommonPattern = mode(vectorPatterns);
  const repetitivePattern = vectorPatterns.filter(p => p === mostCommonPattern).length / vectorPatterns.length > 0.8;
  
  // Check for targeted behavior
  const authorCounts = new Map<string, number>();
  recentReactions.forEach(r => {
    const count = authorCounts.get(r.post.authorId) || 0;
    authorCounts.set(r.post.authorId, count + 1);
  });
  const maxAuthorReactions = Math.max(...authorCounts.values());
  const targetedBehavior = maxAuthorReactions > 10;
  
  // Check velocity
  const reactionsLastMinute = recentReactions.filter(
    r => r.createdAt.getTime() > Date.now() - 60 * 1000
  ).length;
  const velocityAnomaly = reactionsLastMinute > 20;
  
  // Check new account
  const user = await db.users.findUnique({ where: { id: userId } });
  const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const newAccountHighVolume = accountAgeDays < 7 && recentReactions.length > 100;
  
  return {
    repetitivePattern,
    targetedBehavior,
    velocityAnomaly,
    newAccountHighVolume,
  };
}
```

---

## 15. Implementation Roadmap

### Phase 1: Core Foundation (MVP)

**Duration:** Weeks 1-4

**Deliverables:**
- [ ] Database schema for reactions and aggregates
- [ ] Basic 6-vector reactions API (single vector per reaction)
- [ ] Simple reaction button (tap to cycle through vectors)
- [ ] Post aggregate computation
- [ ] Basic feed scoring (Quality + Recency only)
- [ ] Simple Mode Vibe Validator (5 presets)
- [ ] Comment sorting by vector type

**Success Criteria:**
- Users can react with any of 6 vectors
- Feed changes when switching presets
- Comments can be sorted by different vectors

### Phase 2: Radial Wheel & Engagement (Weeks 5-8)

**Deliverables:**
- [ ] Radial Wheel gesture component (React Native)
- [ ] Intensity slider integration
- [ ] Multi-vector reactions
- [ ] Engagement score components
- [ ] Personalization score components
- [ ] Intermediate Mode (4-slider UI)
- [ ] Following/network weighting
- [ ] Real-time aggregate updates via Socket.io

**Success Criteria:**
- Radial wheel works smoothly on iOS and Android
- Users can set intensity 0-100%
- Feed personalizes based on user behavior

### Phase 3: Moderation & Reputation (Weeks 9-12)

**Deliverables:**
- [ ] Mod queue prioritization by flag score
- [ ] Expert flag amplification
- [ ] ConnoisseurCred calculation
- [ ] Activity multiplier for governance
- [ ] Advanced Mode (sub-signal sliders)
- [ ] Node-specific vector customization
- [ ] Basic suppression rules

**Success Criteria:**
- High-questionable content surfaces in mod queue
- Cred scores update based on reactions received
- Advanced users can tune sub-signals

### Phase 4: Expert Features (Weeks 13-16)

**Deliverables:**
- [ ] Expert Mode full parameter access
- [ ] Custom suppression/boost expressions
- [ ] Network controls (vouch weighting)
- [ ] Diversity controls
- [ ] User experiments (A/B testing)
- [ ] Time-based profiles
- [ ] Mood toggles

**Success Criteria:**
- Power users can create custom algorithms
- Users can run experiments on their own feed
- Feed adapts to time of day

### Phase 5: Community & Sharing (Weeks 17-20)

**Deliverables:**
- [ ] Preset save/export
- [ ] Community preset marketplace
- [ ] Preset subscriptions (follow someone's algorithm)
- [ ] Preset ratings and discovery
- [ ] Feed explain endpoint ("Why am I seeing this?")
- [ ] Score debug mode for transparency

**Success Criteria:**
- Users can share and import presets
- Community curates top algorithms
- Full algorithmic transparency

---

## Appendix A: Constants & Defaults

```typescript
// constants/vibes.ts

export const VECTORS = [
  'insightful',
  'joy', 
  'fire',
  'support',
  'shock',
  'questionable'
] as const;

export const VECTOR_COLORS = {
  insightful: '#00BFFF',
  joy: '#FFD700',
  fire: '#FF4500',
  support: '#FF69B4',
  shock: '#32CD32',
  questionable: '#9370DB',
};

export const VECTOR_ICONS = {
  insightful: '💡',
  joy: '😄',
  fire: '🔥',
  support: '💙',
  shock: '⚡',
  questionable: '🤔',
};

export const DEFAULT_SCORING_PARAMS: ScoringParams = {
  // Pillar weights
  qualityWeight: 0.35,
  recencyWeight: 0.25,
  engagementWeight: 0.20,
  personalizationWeight: 0.20,
  
  // Quality params
  credWeight: 0.60,
  vectorQualityWeight: 0.25,
  wilsonWeight: 0.15,
  credCeiling: 5000,
  councilSeatBonus: 1.5,
  newUserBoost: 1.2,
  newUserDurationDays: 30,
  
  // Recency params
  timeDecayWeight: 0.70,
  velocityWeight: 0.20,
  freshnessWeight: 0.10,
  halfLifeHours: 12,
  decayFunction: 'exponential',
  velocityWindowHours: 4,
  velocityMultiplier: 2.0,
  accelerationBonus: 0.5,
  freshnessDurationMin: 60,
  freshnessMultiplier: 1.5,
  
  // Engagement params
  intensityWeight: 0.50,
  discussionWeight: 0.35,
  shareWeight: 0.15,
  intensityScale: 'log',
  intensityCap: 1000,
  depthMultiplier: 2.5,
  expertCommentBonus: 1.5,
  expertCredThreshold: 500,
  shareTrustScaling: true,
  
  // Personalization params
  followingWeight: 0.45,
  alignmentWeight: 0.25,
  affinityWeight: 0.20,
  trustWeight: 0.10,
  followingBoost: 5.0,
  notFollowingBase: 0.2,
  mutualFollowBonus: 1.5,
  followingOnly: false,
  alignmentWindowDays: 30,
  antiAlignmentPenalty: 0.5,
  homeNodeBonus: 2.0,
  maxTrustDistance: 3,
  trustDecayPerHop: 0.5,
  
  // Vector weights
  vectorWeights: {
    insightful: 3.0,
    joy: 1.5,
    fire: 2.0,
    support: 2.5,
    shock: 0.5,
    questionable: -0.5,
  },
  
  // Diversity params
  maxPostsPerAuthor: 3,
  authorCooldownPosts: 5,
  topicClusteringPenalty: 0.1,
  
  // Exploration params
  epsilon: 0.10,
  explorationQualityFloor: 0.3,
  
  // Suppression rules (empty by default)
  suppressionRules: [],
  boostRules: [],
};
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Vibe Vector** | A 6-dimensional array representing reaction intensity across Insightful, Joy, Fire, Support, Shock, and Questionable |
| **Radial Wheel** | The gesture-based UI for selecting reactions with intensity |
| **Vibe Validator** | The UI panel for controlling feed algorithm parameters |
| **ConnoisseurCred** | User reputation score earned through quality contributions |
| **Flag Score** | Computed score indicating content may need moderation review |
| **Pillar** | One of four main feed ranking dimensions (Quality, Recency, Engagement, Personalization) |
| **Sub-signal** | A component factor within a pillar (e.g., Author Cred within Quality) |
| **Preset** | A saved configuration of Vibe Validator settings |
| **Epsilon** | The "serendipity" or exploration rate in feed generation |
| **Wilson Score** | Statistical confidence interval for rating quality with small sample sizes |
| **EigenTrust** | Graph-based reputation algorithm for Sybil resistance |
| **Active Cred** | Base Cred multiplied by Activity Multiplier for governance purposes |

---

**Document Version:** 1.0.0  
**Last Updated:** November 24, 2025  
**Author:** Node Social Development Team  
**Status:** Implementation Ready

---

*"Optimistic Curation over Pessimistic Filtering. Amplify the best; don't just filter the worst."*

**WE ARE NODE. Quality over engagement. Always.**
