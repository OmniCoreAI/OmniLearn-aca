'use client'

import React from 'react'
import toast from 'react-hot-toast'
import { SiX, SiFacebook, SiWhatsapp, SiReddit } from '@icons-pack/react-simple-icons'
import { LinkSimple, ShareNetwork } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const LinkedinIcon = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg role="img" className={className} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);
import { useTranslation } from 'react-i18next'
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics'

interface CourseShareProps {
  courseName: string
  courseUrl: string
  /** Classes for the trigger button. */
  className?: string
}

function CourseShare({ courseName, courseUrl, className }: CourseShareProps) {
  const { t } = useTranslation()
  const { track } = useOmniLearnAnalytics('learner')

  const shareText = `Check out this course: ${courseName}`
  const encodedUrl = encodeURIComponent(courseUrl)
  const encodedText = encodeURIComponent(shareText)

  const shareLinks = [
    { name: 'LinkedIn', icon: LinkedinIcon, url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: 'X', icon: SiX, url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` },
    { name: 'Facebook', icon: SiFacebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'WhatsApp', icon: SiWhatsapp, url: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { name: 'Reddit', icon: SiReddit, url: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}` },
  ]

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(courseUrl)
      track(AnalyticsEvent.CourseShared, { network: 'copy_link', source: 'course_page' })
      toast.success(t('courses.copied'))
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-[13.5px] font-semibold text-[hsl(var(--dash-ink))]/80 transition-colors hover:border-[hsl(var(--dash-ink))]/20 hover:text-[hsl(var(--dash-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-ink))]/20',
          className
        )}
      >
        <ShareNetwork size={16} />
        <span>{t('courses.share_course')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {shareLinks.map((link) => (
          <DropdownMenuItem key={link.name} asChild icon={link.icon}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(AnalyticsEvent.CourseShared, { network: link.name, source: 'course_page' })}
            >
              {link.name}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={LinkSimple} onSelect={copyToClipboard}>
          {t('courses.copy_link')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CourseShare
