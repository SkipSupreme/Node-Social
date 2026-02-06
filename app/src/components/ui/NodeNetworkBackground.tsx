// src/components/ui/NodeNetworkBackground.tsx
// Constellation background - the logo IS the North Star, constellations orbit around it
import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Line, G, Defs, RadialGradient, Stop } from "react-native-svg";

// Star type for the constellation
interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed?: number;
  twinklePhase?: number;
}

// Generate background stars scattered across the sky
// More stars at the edges for ultrawide displays
const generateBackgroundStars = (count: number, seed: number = 42): Star[] => {
  const stars: Star[] = [];
  // Simple seeded random for consistent star positions
  const seededRandom = (i: number) => {
    const x = Math.sin(seed * i * 9999) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    // Bias stars toward edges using a transformation that pushes them outward
    let x = seededRandom(i * 3);
    let y = seededRandom(i * 3 + 1);

    // Push stars toward edges - the further from center, the more likely to stay there
    const centerX = 0.5;
    const centerY = 0.5;
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Apply edge bias - stars closer to center get pushed out slightly
    if (dist < 0.3 && seededRandom(i * 3 + 6) > 0.3) {
      const pushFactor = 1.5 + seededRandom(i * 3 + 7) * 0.8;
      x = centerX + dx * pushFactor;
      y = centerY + dy * pushFactor;
    }

    stars.push({
      x,
      y,
      size: 0.5 + seededRandom(i * 3 + 2) * 1.8,
      brightness: 0.2 + seededRandom(i * 3 + 3) * 0.6,
      twinkleSpeed: 2000 + seededRandom(i * 3 + 4) * 5000,
      twinklePhase: seededRandom(i * 3 + 5) * Math.PI * 2,
    });
  }
  return stars;
};

// Generate extra edge stars specifically for ultrawide
const generateEdgeStars = (count: number, seed: number = 123): Star[] => {
  const stars: Star[] = [];
  const seededRandom = (i: number) => {
    const x = Math.sin(seed * i * 7777) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    // Force stars to edges - left/right sides
    const side = seededRandom(i * 4) > 0.5 ? 1 : 0; // left or right
    const x = side === 0
      ? seededRandom(i * 4 + 1) * 0.25 // left 25%
      : 0.75 + seededRandom(i * 4 + 1) * 0.25; // right 25%
    const y = seededRandom(i * 4 + 2);

    stars.push({
      x,
      y,
      size: 0.4 + seededRandom(i * 4 + 3) * 1.5,
      brightness: 0.15 + seededRandom(i * 4 + 4) * 0.5,
      twinkleSpeed: 2500 + seededRandom(i * 4 + 5) * 4500,
      twinklePhase: seededRandom(i * 4 + 6) * Math.PI * 2,
    });
  }
  return stars;
};

// Real constellation patterns based on actual star positions relative to Polaris
// Coordinates normalized to orbit around center (0,0), scaled to fit nicely
const CONSTELLATION_PATTERNS = [
  // URSA MAJOR (Big Dipper) - the iconic ladle shape
  // Stars: Dubhe, Merak, Phecda, Megrez, Alioth, Mizar, Alkaid
  {
    name: "Ursa Major",
    stars: [
      { x: 0.28, y: 0.35, size: 2.8, brightness: 0.95 },  // Dubhe (α) - bright
      { x: 0.22, y: 0.42, size: 2.5, brightness: 0.9 },   // Merak (β)
      { x: 0.12, y: 0.40, size: 2.4, brightness: 0.85 },  // Phecda (γ)
      { x: 0.15, y: 0.32, size: 2.2, brightness: 0.8 },   // Megrez (δ) - dimmest of the 7
      { x: 0.02, y: 0.30, size: 2.6, brightness: 0.9 },   // Alioth (ε)
      { x: -0.10, y: 0.32, size: 2.5, brightness: 0.88 }, // Mizar (ζ)
      { x: -0.22, y: 0.38, size: 2.4, brightness: 0.85 }, // Alkaid (η) - end of handle
    ],
    lines: [
      // The bowl
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 0 },
      // The handle
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
    ],
  },

  // URSA MINOR (Little Dipper) - smaller ladle, Polaris at tip
  // The logo IS Polaris, so this connects to center
  {
    name: "Ursa Minor",
    stars: [
      { x: 0.05, y: -0.05, size: 2.0, brightness: 0.75 }, // Yildun (δ)
      { x: 0.08, y: -0.12, size: 1.9, brightness: 0.7 },  // ε UMi
      { x: 0.04, y: -0.18, size: 2.0, brightness: 0.72 }, // ζ UMi
      { x: -0.04, y: -0.22, size: 2.6, brightness: 0.92 },// Kochab (β) - bright orange
      { x: -0.10, y: -0.18, size: 2.3, brightness: 0.85 },// Pherkad (γ)
      { x: -0.06, y: -0.12, size: 1.8, brightness: 0.65 },// η UMi
      { x: -0.02, y: -0.06, size: 1.7, brightness: 0.6 }, // Near Polaris
    ],
    lines: [
      // Bowl of little dipper
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 3 },
      // Handle toward Polaris
      { from: 6, to: 0 },
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },

  // CASSIOPEIA - the distinctive W/M shape
  // Stars: Schedar, Caph, Gamma Cas, Ruchbah, Segin
  {
    name: "Cassiopeia",
    stars: [
      { x: -0.38, y: 0.12, size: 2.6, brightness: 0.92 }, // Schedar (α) - orange giant
      { x: -0.32, y: 0.20, size: 2.4, brightness: 0.88 }, // Caph (β)
      { x: -0.24, y: 0.14, size: 2.7, brightness: 0.95 }, // Gamma Cas - brightest, variable
      { x: -0.16, y: 0.22, size: 2.3, brightness: 0.85 }, // Ruchbah (δ)
      { x: -0.08, y: 0.15, size: 2.2, brightness: 0.82 }, // Segin (ε)
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },

  // CEPHEUS - the house/pentagon shape (the King)
  // Stars: Alderamin, Alfirk, Errai, Zeta Cep, Iota Cep
  {
    name: "Cepheus",
    stars: [
      { x: -0.18, y: -0.15, size: 2.5, brightness: 0.9 }, // Alderamin (α) - brightest
      { x: -0.28, y: -0.22, size: 2.2, brightness: 0.8 }, // Alfirk (β)
      { x: -0.24, y: -0.35, size: 2.4, brightness: 0.85 },// Errai (γ) - future pole star
      { x: -0.12, y: -0.35, size: 2.0, brightness: 0.75 },// Zeta Cep
      { x: -0.08, y: -0.22, size: 2.1, brightness: 0.78 },// Iota Cep
    ],
    lines: [
      // The house shape
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 0 },
      // Cross beam
      { from: 1, to: 4 },
    ],
  },

  // DRACO (partial) - the dragon winding between the dippers
  // Key stars from head to tail
  {
    name: "Draco",
    stars: [
      { x: 0.35, y: 0.08, size: 2.3, brightness: 0.85 },  // Eltanin (γ) - dragon's eye, brightest
      { x: 0.38, y: 0.02, size: 2.1, brightness: 0.8 },   // Rastaban (β) - dragon's eye
      { x: 0.32, y: -0.02, size: 1.9, brightness: 0.7 },  // Grumium (ξ)
      { x: 0.28, y: -0.08, size: 1.8, brightness: 0.65 }, // Head toward body
      { x: 0.20, y: -0.12, size: 2.0, brightness: 0.72 }, // χ Dra
      { x: 0.12, y: -0.08, size: 1.9, brightness: 0.7 },  // Body curves
      { x: 0.08, y: 0.02, size: 2.1, brightness: 0.75 },  // η Dra
      { x: 0.15, y: 0.10, size: 2.2, brightness: 0.8 },   // θ Dra
      { x: 0.25, y: 0.15, size: 2.0, brightness: 0.75 },  // ι Dra
      { x: 0.35, y: 0.20, size: 2.4, brightness: 0.88 },  // Thuban (α) - ancient pole star
    ],
    lines: [
      // Dragon's head (diamond shape)
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 0 },
      // Body winding
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },

  // CAMELOPARDALIS - the Giraffe, faint but distinctive
  {
    name: "Camelopardalis",
    stars: [
      { x: 0.42, y: -0.20, size: 1.8, brightness: 0.6 },  // α Cam
      { x: 0.48, y: -0.28, size: 1.7, brightness: 0.55 }, // β Cam
      { x: 0.44, y: -0.38, size: 1.9, brightness: 0.62 }, // γ Cam
      { x: 0.38, y: -0.32, size: 1.6, brightness: 0.5 },  // Body
      { x: 0.32, y: -0.26, size: 1.8, brightness: 0.58 }, // Neck
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 0 },
    ],
  },

  // PERSEUS - the Hero, with distinctive shape
  {
    name: "Perseus",
    stars: [
      { x: -0.48, y: 0.28, size: 2.6, brightness: 0.92 }, // Mirfak (α) - brightest
      { x: -0.52, y: 0.22, size: 2.8, brightness: 0.85 }, // Algol (β) - the Demon Star, variable
      { x: -0.55, y: 0.32, size: 2.0, brightness: 0.72 }, // γ Per
      { x: -0.45, y: 0.35, size: 2.1, brightness: 0.75 }, // δ Per
      { x: -0.42, y: 0.42, size: 1.9, brightness: 0.68 }, // ε Per
      { x: -0.50, y: 0.40, size: 1.8, brightness: 0.65 }, // ζ Per
      { x: -0.58, y: 0.38, size: 2.0, brightness: 0.7 },  // η Per
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 0, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 2 },
    ],
  },

  // AURIGA - the Charioteer, pentagon with Capella
  {
    name: "Auriga",
    stars: [
      { x: -0.60, y: 0.48, size: 3.0, brightness: 0.98 }, // Capella (α) - 6th brightest star!
      { x: -0.52, y: 0.52, size: 2.3, brightness: 0.82 }, // Menkalinan (β)
      { x: -0.48, y: 0.60, size: 2.1, brightness: 0.75 }, // θ Aur
      { x: -0.56, y: 0.65, size: 2.0, brightness: 0.72 }, // ι Aur
      { x: -0.65, y: 0.58, size: 2.2, brightness: 0.78 }, // ε Aur
      { x: -0.58, y: 0.54, size: 1.9, brightness: 0.68 }, // ζ Aur
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 0 },
      { from: 0, to: 5 },
    ],
  },

  // LYNX - faint zigzag constellation
  {
    name: "Lynx",
    stars: [
      { x: 0.50, y: 0.45, size: 1.9, brightness: 0.62 },  // α Lyn
      { x: 0.55, y: 0.50, size: 1.7, brightness: 0.55 },
      { x: 0.52, y: 0.58, size: 1.8, brightness: 0.58 },
      { x: 0.58, y: 0.62, size: 1.6, brightness: 0.52 },
      { x: 0.62, y: 0.55, size: 1.7, brightness: 0.55 },
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },

  // ANDROMEDA - the Princess, chain from Perseus
  {
    name: "Andromeda",
    stars: [
      { x: -0.42, y: 0.05, size: 2.5, brightness: 0.9 },  // Alpheratz (α) - shared with Pegasus
      { x: -0.50, y: 0.02, size: 2.3, brightness: 0.85 }, // Mirach (β)
      { x: -0.58, y: -0.02, size: 2.4, brightness: 0.88 },// Almach (γ) - beautiful double
      { x: -0.48, y: 0.08, size: 1.9, brightness: 0.68 }, // δ And
      { x: -0.54, y: 0.06, size: 1.8, brightness: 0.65 }, // Near M31 galaxy!
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 3, to: 4 },
    ],
  },

  // LACERTA - the Lizard, zigzag between Cygnus and Andromeda
  {
    name: "Lacerta",
    stars: [
      { x: -0.32, y: -0.05, size: 1.8, brightness: 0.6 },
      { x: -0.35, y: -0.10, size: 1.7, brightness: 0.55 },
      { x: -0.30, y: -0.14, size: 1.8, brightness: 0.58 },
      { x: -0.34, y: -0.18, size: 1.6, brightness: 0.52 },
      { x: -0.28, y: -0.22, size: 1.7, brightness: 0.55 },
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },

  // CYGNUS - the Swan / Northern Cross
  {
    name: "Cygnus",
    stars: [
      { x: 0.08, y: 0.52, size: 2.9, brightness: 0.95 },  // Deneb (α) - supergiant!
      { x: 0.02, y: 0.58, size: 2.2, brightness: 0.8 },   // γ Cyg (Sadr) - center of cross
      { x: -0.04, y: 0.64, size: 2.5, brightness: 0.88 }, // Albireo (β) - beautiful double
      { x: 0.08, y: 0.62, size: 2.0, brightness: 0.72 },  // δ Cyg - wing
      { x: -0.06, y: 0.56, size: 2.1, brightness: 0.75 }, // ε Cyg - wing
      { x: 0.00, y: 0.52, size: 1.9, brightness: 0.68 },  // ζ Cyg
    ],
    lines: [
      // Main cross
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      // Wings
      { from: 3, to: 1 },
      { from: 1, to: 4 },
      { from: 5, to: 1 },
    ],
  },

  // LYRA - the Lyre, with bright Vega
  {
    name: "Lyra",
    stars: [
      { x: 0.22, y: 0.55, size: 3.0, brightness: 0.98 },  // Vega (α) - 5th brightest star!
      { x: 0.18, y: 0.60, size: 2.0, brightness: 0.72 },  // Sheliak (β)
      { x: 0.15, y: 0.56, size: 2.1, brightness: 0.75 },  // Sulafat (γ)
      { x: 0.20, y: 0.64, size: 1.8, brightness: 0.65 },  // δ Lyr
      { x: 0.25, y: 0.62, size: 1.9, brightness: 0.68 },  // Ring Nebula area
    ],
    lines: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 1 },
    ],
  },

  // HERCULES - the Hero, keystone shape
  {
    name: "Hercules",
    stars: [
      { x: 0.38, y: 0.48, size: 2.3, brightness: 0.82 },  // Rasalgethi (α) - red giant
      { x: 0.42, y: 0.52, size: 2.4, brightness: 0.85 },  // Kornephoros (β)
      { x: 0.35, y: 0.55, size: 2.1, brightness: 0.78 },  // γ Her
      { x: 0.32, y: 0.50, size: 2.0, brightness: 0.75 },  // δ Her - keystone
      { x: 0.38, y: 0.58, size: 2.2, brightness: 0.8 },   // ε Her - keystone
      { x: 0.44, y: 0.58, size: 2.0, brightness: 0.75 },  // ζ Her - keystone
      { x: 0.46, y: 0.52, size: 2.1, brightness: 0.78 },  // η Her - keystone
    ],
    lines: [
      // The Keystone
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 3 },
      // Extensions
      { from: 0, to: 3 },
      { from: 1, to: 6 },
      { from: 2, to: 4 },
    ],
  },

  // CORONA BOREALIS - the Northern Crown, beautiful arc
  {
    name: "Corona Borealis",
    stars: [
      { x: 0.52, y: 0.38, size: 2.5, brightness: 0.88 },  // Alphecca (α) - the gem
      { x: 0.48, y: 0.35, size: 2.0, brightness: 0.72 },  // β CrB
      { x: 0.55, y: 0.35, size: 1.9, brightness: 0.7 },   // γ CrB
      { x: 0.58, y: 0.38, size: 1.8, brightness: 0.65 },  // δ CrB
      { x: 0.56, y: 0.42, size: 1.9, brightness: 0.68 },  // ε CrB
      { x: 0.50, y: 0.42, size: 1.8, brightness: 0.65 },  // θ CrB
      { x: 0.46, y: 0.40, size: 1.7, brightness: 0.62 },  // ι CrB
    ],
    lines: [
      { from: 6, to: 1 },
      { from: 1, to: 0 },
      { from: 0, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
    ],
  },

  // BOOTES - the Herdsman, kite shape with Arcturus
  {
    name: "Bootes",
    stars: [
      { x: 0.62, y: 0.25, size: 3.2, brightness: 1.0 },   // Arcturus (α) - 4th brightest star!
      { x: 0.58, y: 0.18, size: 2.2, brightness: 0.8 },   // Nekkar (β)
      { x: 0.65, y: 0.15, size: 2.1, brightness: 0.78 },  // γ Boo
      { x: 0.68, y: 0.22, size: 2.0, brightness: 0.75 },  // δ Boo
      { x: 0.64, y: 0.30, size: 2.3, brightness: 0.82 },  // ε Boo (Izar)
      { x: 0.55, y: 0.28, size: 1.9, brightness: 0.7 },   // ρ Boo
    ],
    lines: [
      { from: 0, to: 4 },
      { from: 4, to: 3 },
      { from: 3, to: 2 },
      { from: 2, to: 1 },
      { from: 1, to: 5 },
      { from: 5, to: 0 },
      { from: 0, to: 1 },
    ],
  },

  // GEMINI - the Twins, with Castor and Pollux
  {
    name: "Gemini",
    stars: [
      { x: -0.65, y: 0.70, size: 2.7, brightness: 0.92 }, // Castor (α) - sextuple star system
      { x: -0.62, y: 0.75, size: 2.9, brightness: 0.95 }, // Pollux (β) - brightest, orange giant
      { x: -0.70, y: 0.68, size: 2.0, brightness: 0.72 }, // γ Gem (Alhena)
      { x: -0.75, y: 0.72, size: 1.9, brightness: 0.68 }, // μ Gem
      { x: -0.68, y: 0.78, size: 2.1, brightness: 0.75 }, // ε Gem (Mebsuta)
      { x: -0.72, y: 0.82, size: 1.8, brightness: 0.65 }, // ζ Gem
    ],
    lines: [
      // Castor's line
      { from: 0, to: 2 },
      { from: 2, to: 3 },
      // Pollux's line
      { from: 1, to: 4 },
      { from: 4, to: 5 },
      // Connect twins
      { from: 0, to: 1 },
    ],
  },
];

// More background stars for a richer sky
const BACKGROUND_STARS = generateBackgroundStars(150);
const EDGE_STARS = generateEdgeStars(80);

export const NodeNetworkBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const twinkleAnim = useRef(new Animated.Value(0)).current;

  const centerX = width / 2;
  const centerY = height / 2;
  const skyRadius = Math.min(width, height) * 0.5;

  useEffect(() => {
    // Slow rotation of constellations around North Star (one full rotation per 3 minutes)
    const rotateLoop = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 180000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    // Twinkle animation for background stars
    const twinkleLoop = Animated.loop(
      Animated.timing(twinkleAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    rotateLoop.start();
    twinkleLoop.start();

    return () => {
      rotateLoop.stop();
      twinkleLoop.stop();
    };
  }, []);

  const [rotation, setRotation] = React.useState(0);
  const [twinkleTime, setTwinkleTime] = React.useState(0);

  useEffect(() => {
    const listener = rotationAnim.addListener(({ value }) => {
      setRotation(value * Math.PI * 2);
    });
    return () => rotationAnim.removeListener(listener);
  }, [rotationAnim]);

  useEffect(() => {
    const listener = twinkleAnim.addListener(({ value }) => {
      setTwinkleTime(value * 10000);
    });
    return () => twinkleAnim.removeListener(listener);
  }, [twinkleAnim]);

  // Rotate a point around the center (where the logo is)
  const rotatePoint = (x: number, y: number, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: centerX + (x * cos - y * sin) * skyRadius,
      y: centerY + (x * sin + y * cos) * skyRadius,
    };
  };

  // Calculate twinkle opacity for a star
  const getTwinkle = (star: Star) => {
    if (!star.twinkleSpeed || !star.twinklePhase) return star.brightness;
    const phase = (twinkleTime / star.twinkleSpeed + star.twinklePhase) % 1;
    const twinkle = Math.sin(phase * Math.PI * 2) * 0.3;
    return Math.max(0.1, Math.min(1, star.brightness + twinkle));
  };

  // Project constellation stars with rotation
  const projectedConstellations = useMemo(() => {
    return CONSTELLATION_PATTERNS.map((constellation) => ({
      stars: constellation.stars.map((star) => ({
        ...rotatePoint(star.x, star.y, rotation),
        size: star.size,
        brightness: star.brightness,
      })),
      lines: constellation.lines,
    }));
  }, [rotation, centerX, centerY, skyRadius]);

  // Project background stars (they rotate slower for parallax)
  const projectedBackgroundStars = useMemo(() => {
    return BACKGROUND_STARS.map((star) => {
      // Convert from 0-1 to screen coordinates
      // Use full screen coverage for background stars
      const screenX = star.x * width;
      const screenY = star.y * height;

      // Apply slow rotation around center for parallax effect
      const dx = screenX - centerX;
      const dy = screenY - centerY;
      const cos = Math.cos(rotation * 0.15);
      const sin = Math.sin(rotation * 0.15);

      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
        size: star.size,
        brightness: getTwinkle(star),
      };
    });
  }, [rotation, twinkleTime, width, height, centerX, centerY]);

  // Project edge stars (no rotation, they're the far background)
  const projectedEdgeStars = useMemo(() => {
    return EDGE_STARS.map((star) => ({
      x: star.x * width,
      y: star.y * height,
      size: star.size,
      brightness: getTwinkle(star),
    }));
  }, [twinkleTime, width, height]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { pointerEvents: 'none' }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Glow gradient for brighter stars */}
          <RadialGradient id="starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <Stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Edge stars layer (furthest back, static) - extra for ultrawide */}
        <G opacity={0.6}>
          {projectedEdgeStars.map((star, i) => (
            <Circle
              key={`edge-star-${i}`}
              cx={star.x}
              cy={star.y}
              r={star.size}
              fill="#ffffff"
              opacity={star.brightness}
            />
          ))}
        </G>

        {/* Background stars layer */}
        <G opacity={0.7}>
          {projectedBackgroundStars.map((star, i) => (
            <Circle
              key={`bg-star-${i}`}
              cx={star.x}
              cy={star.y}
              r={star.size}
              fill="#ffffff"
              opacity={star.brightness}
            />
          ))}
        </G>

        {/* Constellation lines */}
        <G opacity={0.2}>
          {projectedConstellations.map((constellation, ci) =>
            constellation.lines.map((line, li) => {
              const from = constellation.stars[line.from];
              const to = constellation.stars[line.to];
              return (
                <Line
                  key={`line-${ci}-${li}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#ffffff"
                  strokeWidth={0.6}
                  strokeLinecap="round"
                />
              );
            })
          )}
        </G>

        {/* Constellation stars */}
        <G>
          {projectedConstellations.map((constellation, ci) =>
            constellation.stars.map((star, si) => (
              <G key={`star-${ci}-${si}`}>
                {/* Star glow */}
                <Circle
                  cx={star.x}
                  cy={star.y}
                  r={star.size * 3}
                  fill="url(#starGlow)"
                  opacity={star.brightness * 0.25}
                />
                {/* Star core */}
                <Circle
                  cx={star.x}
                  cy={star.y}
                  r={star.size}
                  fill="#ffffff"
                  opacity={star.brightness}
                />
              </G>
            ))
          )}
        </G>

        {/* No North Star rendered here - the logo IS the North Star */}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default NodeNetworkBackground;
