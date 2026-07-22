'use client'

import React from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Fade + slide-up entrance for a single block.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Container that staggers its <StaggerItem> children.
 */
export function Stagger({
  children,
  className,
  staggerDelay = 0.07,
}: {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Animated number count-up (respects reduced motion).
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 24 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString())

  React.useEffect(() => {
    motionValue.set(value)
  }, [motionValue, value])

  if (reduceMotion) {
    return <span className={className}>{value.toLocaleString()}</span>
  }

  return <motion.span className={className}>{display}</motion.span>
}

/**
 * Animated circular progress ring (Skillio-style).
 */
export function ProgressRing({
  percent,
  size = 132,
  strokeWidth = 11,
  label,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  label?: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--dash-accent-soft))"
          strokeWidth={strokeWidth}
        />
        {reduceMotion ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--dash-accent))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--dash-accent))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label ?? (
          <span className="text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
            <CountUp value={clamped} />%
          </span>
        )}
      </div>
    </div>
  )
}
