import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  try {
    const allegato = await prisma.allegato.findUnique({ where: { id: BigInt(id) } })
    if (!allegato) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })

    if (allegato.storageUrl) {
      await del(allegato.storageUrl)
    }
    await prisma.allegato.delete({ where: { id: BigInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
