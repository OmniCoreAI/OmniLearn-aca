'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Course cover: the uploaded thumbnail when there is one, otherwise (or when it
 * fails to load) a generated cover — one of a few EACA-palette gradients picked
 * deterministically from the seed, with the course initials over a faint dot
 * pattern.
 */
const COVERS = [
  { from: 'hsl(43 78% 56%)', to: 'hsl(32 70% 38%)', ink: 'hsl(40 60% 97%)' }, // gold
  { from: 'hsl(0 0% 18%)', to: 'hsl(0 0% 6%)', ink: 'hsl(43 80% 64%)' }, // ink + gold
  { from: 'hsl(351 62% 52%)', to: 'hsl(351 72% 32%)', ink: 'hsl(351 80% 96%)' }, // flag red
  { from: 'hsl(28 58% 56%)', to: 'hsl(20 55% 34%)', ink: 'hsl(30 70% 96%)' }, // bronze
  { from: 'hsl(40 14% 70%)', to: 'hsl(35 10% 42%)', ink: 'hsl(40 30% 97%)' }, // stone
]

function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function courseInitials(name: string) {
  const words = name
    .replace(/[—–-]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
  // Prefer words that start with a letter ("AI-501 Machine Learning" → "AM"),
  // falling back to numbers only when there aren't two letter-words.
  const lettered = words.filter((w) => /^\p{L}/u.test(w))
  const picked = (lettered.length >= 2 ? lettered : words).slice(0, 2)
  return picked.map((w) => [...w][0] ?? '').join('').toUpperCase() || '•'
}

export default function CourseCover({
  name,
  seed,
  src,
  className,
  size = 'md',
}: {
  name: string
  /** Stable key for the palette pick (defaults to the name). */
  seed?: string
  /** Uploaded thumbnail; the generated cover shows if it is missing or broken. */
  src?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const palette = COVERS[hash(seed ?? name) % COVERS.length]!
  const showImage = !!src && failedSrc !== src
  return (
    <div
      aria-hidden="true"
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(${palette.ink} 1px, transparent 1px)`,
          backgroundSize: '14px 14px',
        }}
      />
      <div
        className="absolute -end-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ background: palette.ink }}
      />
      <span
        className={cn(
          'absolute bottom-3 start-4 font-semibold tracking-tight',
          size === 'sm' && 'text-xl',
          size === 'md' && 'text-3xl',
          size === 'lg' && 'text-5xl'
        )}
        style={{ color: palette.ink }}
      >
        {courseInitials(name)}
      </span>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  )
}
