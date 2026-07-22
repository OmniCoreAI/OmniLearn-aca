'use client'

import React from 'react'
import { motion, useReducedMotion } from 'motion/react'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Remounts on every dash segment navigation — soft page enter animation.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    )
  }

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col will-change-[opacity,transform]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
