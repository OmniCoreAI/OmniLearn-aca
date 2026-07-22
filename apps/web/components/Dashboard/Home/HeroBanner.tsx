'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, GraduationCap, BookOpen, Sparkle } from '@phosphor-icons/react'

export default function HeroBanner({ orgName }: { orgName?: string }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  const float = (delay: number) =>
    reduceMotion
      ? {}
      : {
          animate: { y: [0, -8, 0] },
          transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const, delay },
        }

  return (
    <section
      className="relative overflow-hidden rounded-[var(--dash-radius)] p-6 sm:p-8"
      style={{
        background:
          'linear-gradient(110deg, hsl(var(--dash-gradient-from)), hsl(var(--dash-gradient-via)) 55%, hsl(var(--dash-gradient-to)))',
      }}
    >
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-28 end-40 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <motion.div className="absolute end-10 top-8 hidden text-white/25 sm:block" {...float(0)}>
          <BookOpen size={54} weight="duotone" />
        </motion.div>
        <motion.div className="absolute end-40 bottom-8 hidden text-white/20 lg:block" {...float(1.2)}>
          <GraduationCap size={64} weight="duotone" />
        </motion.div>
        <motion.div className="absolute end-72 top-12 hidden text-white/20 xl:block" {...float(0.6)}>
          <Sparkle size={36} weight="duotone" />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-xl">
        <h2 className="text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
          {t('dashboard.home.hero_title', 'Build your next great course today')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          {orgName
            ? t(
                'dashboard.home.hero_subtitle_org',
                'Create engaging content for {{org}} and keep your learners moving forward.',
                { org: orgName }
              )
            : t(
                'dashboard.home.hero_subtitle',
                'Create engaging content and keep your learners moving forward.'
              )}
        </p>
        <Link
          href="/dash/courses?new=true"
          className="dash-lift mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[hsl(var(--dash-accent))] shadow-[0_4px_14px_hsl(262_83%_30%/0.3)] hover:bg-white/95"
        >
          {t('dashboard.home.hero_cta', 'Create a course')}
          <ArrowUpRight size={16} weight="bold" />
        </Link>
      </div>
    </section>
  )
}
