# Vibe Validator Parameters - Tiered Control System

## Simple Mode: Presets (Choose One)

**Latest First** - Time-prioritized
- Recency: 80%
- Quality: 10%
- Engagement: 5%
- Personalization: 5%

**Balanced** (Default/Recommended)
- Quality: 35%
- Recency: 30%
- Engagement: 20%
- Personalization: 15%

**Most Popular** - Viral-prioritized
- Engagement: 50%
- Quality: 25%
- Recency: 15%
- Personalization: 10%

**Expert Voices** - ConnoisseurCred-focused
- Quality: 60%
- Personalization: 20%
- Engagement: 15%
- Recency: 5%

**Personal Network** - Following-prioritized
- Personalization: 60%
- Recency: 25%
- Quality: 10%
- Engagement: 5%

---

## Intermediate Mode: Primary Sliders

### 1. **Quality Weight** (35% default) 🎯 *HIGHEST PRIORITY*
- What it controls: ConnoisseurCred scores, Vibe Vector diversity, Wilson confidence scores
- User-facing label: "Show quality content from trusted voices"
- Why first: This is Node Social's core differentiator

### 2. **Recency Weight** (30% default) ⏰
- What it controls: Time decay with configurable half-life
- User-facing label: "Show newer posts"
- Sub-control: Half-life selector (Last hour / Today / This week / All time)

### 3. **Engagement Weight** (20% default) 🔥
- What it controls: Total Vibe Vector intensity, reaction count, comment depth
- User-facing label: "Show popular posts"
- Note: Uses logarithmic scaling to prevent runaway virality

### 4. **Personalization Weight** (15% default) 💙
- What it controls: Following relationships, Vibe Vector alignment, Node membership
- User-facing label: "Show posts from people I follow"

---

## Advanced Mode: Granular Controls

### A. Quality Signals (35% total weight)

#### 1. **ConnoisseurCred Score** (60% of quality)
- Formula: User's NodeCred * Active Seat multiplier
- Range: 0-100 normalized per Node

#### 2. **Vibe Vector Diversity** (25% of quality)
- Formula: Number of distinct Vibe types / User's intensity variance
- Rewards posts that get varied thoughtful reactions

#### 3. **Wilson Confidence Score** (15% of quality)
- Formula: Statistical confidence interval on upvote ratio
- Prevents low-sample-size bias

---

### B. Recency Signals (30% total weight)

#### 1. **Post Age** (70% of recency)
- Exponential decay with user-selected half-life
- Options: 1h, 6h, 12h (default), 24h, 7d

#### 2. **Trending Velocity** (20% of recency)
- Recent engagement rate (reactions in last 4 hours)
- Catches rising posts early

#### 3. **Last Interaction Recency** (10% of recency)
- Time since you last engaged with this author
- Surfaces creators you haven't seen lately

---

### C. Engagement Signals (20% total weight)

#### 1. **Vibe Vector Intensity** (40% of engagement)
- Weighted sum: `Sum(reaction_count × intensity × vector_weight)`
- Default vector weights:
  - Saves/Novel: 6.0x
  - Shares: 4.0x
  - Insightful: 3.0x
  - Funny: 1.5x
  - Cursed: 0.5x (negative signal)

#### 2. **Comment Depth** (35% of engagement)
- Formula: `Log(comment_count) × avg_thread_depth × 2.5`
- Rewards meaningful discussion over quick reactions

#### 3. **Expert Gate Engagement** (15% of engagement)
- Bonus multiplier if high-Cred users engaged
- Formula: `(reactions_from_experts / total_reactions) × 1.5`

#### 4. **Share Rate** (10% of engagement)
- Shares / Views ratio
- Strong quality signal (people stake reputation)

---

### D. Personalization Signals (15% total weight)

#### 1. **Following Relationship** (50% of personalization)
- Binary: 100 if following, 20 if not
- Adjustable: "Following Only" toggle

#### 2. **Vibe Vector Alignment** (30% of personalization)
- Cosine similarity between your typical reactions and post's Vibe profile
- Formula: `dot_product(user_vibe_history, post_vibes) / magnitudes`

#### 3. **Node Affinity** (15% of personalization)
- Your NodeCred in the post's Node
- Higher score = more weight from Nodes where you're active

#### 4. **Web of Trust Distance** (5% of personalization)
- Graph distance through Vouch relationships
- 1-degree: 1.5x, 2-degree: 1.2x, 3+: 1.0x

---

## Expert Mode: Micro-Tuning

### Individual Vibe Vector Weights
Adjust each Vibe type independently:
- **Insightful**: 3.0x (default)
- **Novel**: 6.0x (default)
- **Funny**: 1.5x (default)
- **Cursed**: 0.5x (default)
- **Custom Node Vibes**: Per-Node configuration

### Diversity & Exploration
- **Epsilon-Greedy**: 0-20% random boost (default: 10%)
- **Category Diversity**: Bonus for underrepresented topics
- **Author Diversity**: Prevent same-author domination
- **Chaos Node Injection**: % of feed from n/chaos (0-10%)

### Filters & Constraints
- **Minimum ConnoisseurCred**: Threshold to appear in feed
- **Expert Gate Filter**: Show only Expert-Gated posts toggle
- **Content Types**: Text / Images / Video / Links checkboxes
- **Node Subscriptions**: Include/exclude specific Nodes
- **Time Range**: Last N hours/days/weeks

---

## Implementation Priority Order

1. **Quality Weight** - Core differentiator, implement first
2. **Recency Weight** - Standard feed requirement
3. **Personalization Weight** - Essential for retention
4. **Engagement Weight** - Important but less unique
5. **Vibe Vector Intensity** - Unique to Node Social
6. **ConnoisseurCred Score** - Powers quality weight
7. **Comment Depth** - Quality engagement signal
8. **Wilson Confidence** - Prevents gaming
9. **Following Relationship** - Simple personalization
10. **Vibe Vector Diversity** - Advanced quality metric
11. **Trending Velocity** - Real-time discovery
12. **Vibe Vector Alignment** - Sophisticated personalization
13. **Expert Gate Engagement** - Premium quality signal
14. **Node Affinity** - Community-specific relevance
15. **Web of Trust Distance** - Network effects

---

## UI Hierarchy

```
┌─────────────────────────────────────┐
│  ⚙️  Feed Controls                   │
├─────────────────────────────────────┤
│                                     │
│  Quick Presets:                     │
│  ○ Latest First                     │
│  ● Balanced (recommended)           │
│  ○ Most Popular                     │
│  ○ Expert Voices                    │
│  ○ Personal Network                 │
│  ○ Custom ↓                         │
│                                     │
├─────────────────────────────────────┤
│  [WHEN CUSTOM SELECTED]             │
│                                     │
│  Main Controls:                     │
│  Quality      [━━━━━━━░░░] 35%     │
│  Recency      [━━━━━░░░░░] 30%     │
│  Engagement   [━━━░░░░░░░] 20%     │
│  Personal     [━━░░░░░░░░] 15%     │
│                                     │
│  ⚙️ Advanced Settings ↓             │
│                                     │
├─────────────────────────────────────┤
│  [WHEN ADVANCED EXPANDED]           │
│                                     │
│  Quality Signals:                   │
│    ConnoisseurCred  [━━━━━━░░░░]   │
│    Vibe Diversity   [━━━░░░░░░░]   │
│    Confidence       [━━░░░░░░░░]   │
│                                     │
│  Recency Signals:                   │
│    Post Age Half-life: [12h ▼]     │
│    Trending Boost   [━━░░░░░░░░]   │
│                                     │
│  Engagement Signals:                │
│    Vibe Intensity   [━━━━░░░░░░]   │
│    Comment Depth    [━━━░░░░░░░]   │
│    Expert Reactions [━━░░░░░░░░]   │
│                                     │
│  Personalization:                   │
│    Following Only   [Toggle: OFF]  │
│    Vibe Alignment   [━━━░░░░░░░]   │
│    Node Affinity    [━░░░░░░░░░]   │
│                                     │
│  🎲 Exploration:                    │
│    Random Boost     [━░░░░░░░░░] 10%│
│                                     │
│  🔧 Expert Mode ↓                   │
│                                     │
└─────────────────────────────────────┘
```

This gives you a **progressive disclosure** system where 90% of users will use presets, 8% will use the main 4 sliders, and 2% power users will dive into advanced/expert modes. Each layer provides meaningful control without overwhelming users.