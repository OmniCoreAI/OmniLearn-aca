'use client'
import { useTranslation } from 'react-i18next'

interface NewCourseButtonProps {
  disabled?: boolean
}

function NewCourseButton({ disabled = false }: NewCourseButtonProps) {
  const { t } = useTranslation()
  return (
    <div
      className={`my-auto flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] transition-all duration-200 ease-out antialiased ${
        disabled ? 'cursor-not-allowed opacity-50' : 'dash-lift hover:brightness-110'
      }`}
    >
      <div>{t('courses.new_course')} </div>
      <div className="rounded-full bg-white/20 px-1.5 text-md leading-none">+</div>
    </div>
  )
}

export default NewCourseButton
