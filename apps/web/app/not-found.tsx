import { ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[hsl(var(--dash-canvas))] px-4">
      <div className="w-full max-w-md rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
          <Compass size={28} />
        </div>
        <p className="mt-6 text-sm font-semibold tracking-widest text-[hsl(var(--dash-accent))]">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[hsl(var(--dash-ink))]">Page not found</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--dash-muted))]">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[hsl(var(--dash-ink))] px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go to the homepage
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
