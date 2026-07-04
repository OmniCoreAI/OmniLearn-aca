import React from 'react'
import SemesterDetail from './client'

async function SemesterDetailPage(props: {
  params: Promise<{ orgslug: string; programuuid: string; cohortuuid: string; semesteruuid: string }>
}) {
  const { orgslug, programuuid, cohortuuid, semesteruuid } = await props.params
  return (
    <SemesterDetail
      orgslug={orgslug}
      programuuid={programuuid}
      cohortuuid={cohortuuid}
      semesteruuid={semesteruuid}
    />
  )
}

export default SemesterDetailPage
