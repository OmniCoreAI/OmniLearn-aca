import React from 'react'
import CurriculumEditor from './client'

async function CurriculumPage(props: {
  params: Promise<{ orgslug: string; programuuid: string; curriculumuuid: string }>
}) {
  const { orgslug, programuuid, curriculumuuid } = await props.params
  return <CurriculumEditor orgslug={orgslug} programuuid={programuuid} curriculumuuid={curriculumuuid} />
}

export default CurriculumPage
