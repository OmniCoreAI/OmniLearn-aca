import React from 'react'
import NewsEditorClient from '../NewsEditorClient'

async function NewNewsPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <NewsEditorClient orgslug={orgslug} />
}

export default NewNewsPage
