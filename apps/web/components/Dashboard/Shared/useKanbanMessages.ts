'use client'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { KanbanMessages } from '@/components/ui/kanban-board'

/** Translated keyboard / screen-reader messages for every KanbanBoard in the dashboard. */
export function useKanbanMessages(): KanbanMessages {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      pickUp: (title) => String(t('board.pick_up', '{{title}}. Press space to pick up.', { title })),
      pickedUp: (title) => String(t('board.picked_up', 'Picked up {{title}}. Use the arrow keys to move it.', { title })),
      moved: (title, column, position) => String(t('board.moved', '{{title}} moved to {{column}}, position {{position}}.', { title, column, position })),
      dropped: (title, column, position) => String(t('board.dropped', 'Dropped {{title}} in {{column}}, position {{position}}.', { title, column, position })),
      cancelled: (title) => String(t('board.cancelled', 'Cancelled. {{title}} is back where it started.', { title })),
      notAllowed: (title, column) => String(t('board.not_allowed', '{{title}} cannot go to {{column}}.', { title, column })),
      draggableCard: String(t('board.draggable_card', 'Draggable card')),
    }),
    [t]
  )
}
