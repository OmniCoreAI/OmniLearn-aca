import React from 'react'
import NewsEditorClient from '../NewsEditorClient'

async function EditNewsPage(props: {
  params: Promise<{ orgslug: string; newsuuid: string }>
}) {
  const { orgslug, newsuuid } = await props.params
  return <NewsEditorClient orgslug={orgslug} newsUuid={newsuuid} />
}

export default EditNewsPage
