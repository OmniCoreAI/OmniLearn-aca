import React from 'react'
import NewsListClient from './client'

async function CMSNewsPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <NewsListClient orgslug={orgslug} />
}

export default CMSNewsPage
