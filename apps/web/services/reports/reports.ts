import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'

export type ReportRange = { date_from: string; date_to: string; previous_from: string; previous_to: string; months: string[] }
export type AmountRow = { key: string; label: string; total: number; count: number; share_pct: number }

export type FinancialTotals = {
  gross_revenue: number
  refunds: number
  net_revenue: number
  operating_expenses: number
  instructor_cost: number
  total_costs: number
  net_profit: number
  margin_pct: number
  instructor_hours: number
  revenue_entries: number
  expense_entries: number
}

export type FinancialReport = {
  range: ReportRange
  currency: string
  totals: FinancialTotals
  previous: FinancialTotals
  monthly: { month: string; revenue: number; refunds: number; expenses: number; instructor_cost: number; net: number }[]
  revenue_by_category: AmountRow[]
  revenue_by_payment_method: AmountRow[]
  revenue_by_course: AmountRow[]
  expenses_by_category: AmountRow[]
  top_revenue: { entry_uuid: string; title: string; category: string; amount: number; entry_date: string; payment_method: string | null; course_name: string | null }[]
  instructors: { instructor_uuid: string | null; name: string; hours: number; sessions: number; amount: number; avg_rate: number; courses: string[]; share_pct: number }[]
  instructor_cost_by_course: { course_uuid: string | null; course_name: string; hours: number; amount: number; instructors: number }[]
}

export type LearningTotals = { enrollments: number; completions: number; active_learners: number; lessons_completed: number; certificates: number }
export type LearningReport = {
  range: ReportRange
  totals: LearningTotals
  previous: LearningTotals
  overall_completion_rate: number
  total_enrolled: number
  monthly: ({ month: string } & Omit<LearningTotals, 'certificates'>)[]
  courses: {
    course_uuid: string
    course_name: string
    published: boolean
    lessons: number
    enrolled: number
    new_enrollments: number
    active_learners: number
    completed: number
    completion_rate: number
    avg_progress: number
  }[]
}

export type AdmissionsTotals = {
  submitted: number
  accepted: number
  rejected: number
  enrolled: number
  pending: number
  withdrawn: number
  acceptance_rate: number
  avg_days_to_decision: number | null
}
export type AdmissionsGroupRow = { key: string; name: string; submitted: number; accepted: number; rejected: number; enrolled: number; pending: number; acceptance_rate: number }
export type AdmissionsReport = {
  range: ReportRange
  totals: AdmissionsTotals
  previous: AdmissionsTotals
  drafts: number
  documents_pending: number
  monthly: { month: string; submitted: number; decided: number; accepted: number }[]
  by_status: { status: string; count: number; share_pct: number }[]
  by_program: AdmissionsGroupRow[]
  by_intake: AdmissionsGroupRow[]
  interviews: { scheduled: number; completed: number; no_show: number; cancelled: number; avg_score: number | null }
}

export type PeopleTotals = { members: number; new_members: number; signed_in: number; active_learners: number; never_signed_in: number; entities: number }
export type PeopleReport = {
  range: ReportRange
  totals: PeopleTotals
  previous: PeopleTotals
  monthly: { month: string; new_members: number; active_learners: number }[]
  by_role: { role: string; role_uuid: string; count: number; share_pct: number }[]
  entities: {
    entity_uuid: string
    name: string
    name_ar: string | null
    code: string
    members: number
    coordinators: number
    active_learners: number
    enrollments: number
    completions: number
    completion_rate: number
  }[]
  unassigned_members: number
}

export type ReportKind = 'financial' | 'learning' | 'admissions' | 'people'
type ReportOf<K extends ReportKind> = K extends 'financial'
  ? FinancialReport
  : K extends 'learning'
    ? LearningReport
    : K extends 'admissions'
      ? AdmissionsReport
      : PeopleReport

/** One academy report for an inclusive date range. */
export function useReport<K extends ReportKind>(kind: K, range: { from: string; to: string }, enabled = true) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  const orgId: number | undefined = org?.id
  return useQuery<ReportOf<K>>({
    queryKey: ['reports', kind, orgId, range.from, range.to],
    queryFn: () =>
      apiFetch(
        `${getAPIUrl()}reports/org/${orgId}/${kind}?${new URLSearchParams({ date_from: range.from, date_to: range.to })}`,
        token
      ),
    enabled: enabled && !!orgId && !!token,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}
