"use client";
import { MotionConfig } from "motion/react";

// Moves stop for people who ask their system for less motion
export function Motion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
