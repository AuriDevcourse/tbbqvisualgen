"use client";

import { LiquidMetal } from "@paper-design/shaders-react";
import type { LiquidMetalShape } from "@paper-design/shaders";

interface LiquidMetalBgProps {
  mood: string;
  width: number;
  height: number;
  paused?: boolean;
}

interface MoodConfig {
  label: string;
  colorBack: string;
  colorTint: string;
  shape: LiquidMetalShape;
  scale: number;
  speed: number;
  repetition: number;
  softness: number;
  distortion: number;
  contour: number;
  angle: number;
  shiftRed: number;
  shiftBlue: number;
  frame: number;
}

const MOODS: Record<string, MoodConfig> = {
  // Elegant gold — warm dark base, gold metallic sheen
  lm1: {
    label: "Elegant Gold",
    colorBack: "#1a0800",
    colorTint: "#FFD000",
    shape: "none",
    scale: 1.6,
    speed: 0.25,
    repetition: 1.5,
    softness: 0.25,
    distortion: 0.08,
    contour: 0.35,
    angle: 45,
    shiftRed: 0.2,
    shiftBlue: -0.15,
    frame: 0,
  },
  // Warm amber — professional, flowing amber tones
  lm2: {
    label: "Warm Amber",
    colorBack: "#0d0500",
    colorTint: "#FF9500",
    shape: "none",
    scale: 1.4,
    speed: 0.2,
    repetition: 2,
    softness: 0.35,
    distortion: 0.06,
    contour: 0.3,
    angle: 90,
    shiftRed: 0.15,
    shiftBlue: -0.2,
    frame: 10,
  },
  // Creative magenta — magenta-gold energy
  lm3: {
    label: "Creative Magenta",
    colorBack: "#0a0008",
    colorTint: "#CC3399",
    shape: "metaballs",
    scale: 1.3,
    speed: 0.3,
    repetition: 1.8,
    softness: 0.2,
    distortion: 0.1,
    contour: 0.4,
    angle: 135,
    shiftRed: 0.35,
    shiftBlue: 0.1,
    frame: 5,
  },
  // Energetic copper — bright, dynamic, diagonal flow
  lm4: {
    label: "Energetic Copper",
    colorBack: "#120600",
    colorTint: "#FF6B00",
    shape: "none",
    scale: 1.8,
    speed: 0.35,
    repetition: 1.3,
    softness: 0.15,
    distortion: 0.12,
    contour: 0.45,
    angle: 60,
    shiftRed: 0.3,
    shiftBlue: -0.25,
    frame: 20,
  },
  // Bold red-gold — centered, impactful
  lm5: {
    label: "Bold Red-Gold",
    colorBack: "#0a0000",
    colorTint: "#FF2200",
    shape: "diamond",
    scale: 1.5,
    speed: 0.2,
    repetition: 2,
    softness: 0.3,
    distortion: 0.07,
    contour: 0.35,
    angle: 70,
    shiftRed: 0.25,
    shiftBlue: -0.1,
    frame: 15,
  },
  // Deep copper — smooth, luxurious
  lm6: {
    label: "Deep Copper",
    colorBack: "#080400",
    colorTint: "#CC7700",
    shape: "none",
    scale: 1.6,
    speed: 0.15,
    repetition: 1.8,
    softness: 0.4,
    distortion: 0.05,
    contour: 0.25,
    angle: 120,
    shiftRed: 0.1,
    shiftBlue: -0.3,
    frame: 30,
  },
};

export const LIQUID_METAL_IDS = Object.keys(MOODS);
export const LIQUID_METAL_CONFIGS = MOODS;

export function LiquidMetalBg({ mood, width, height, paused }: LiquidMetalBgProps) {
  const config = MOODS[mood];
  if (!config) return null;

  return (
    <LiquidMetal
      colorBack={config.colorBack}
      colorTint={config.colorTint}
      shape={config.shape}
      scale={config.scale}
      speed={paused ? 0 : config.speed}
      repetition={config.repetition}
      softness={config.softness}
      distortion={config.distortion}
      contour={config.contour}
      angle={config.angle}
      shiftRed={config.shiftRed}
      shiftBlue={config.shiftBlue}
      frame={config.frame}
      fit="cover"
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
      }}
      webGlContextAttributes={{ preserveDrawingBuffer: true }}
    />
  );
}
