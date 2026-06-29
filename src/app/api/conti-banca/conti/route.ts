import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const conti = await prisma.contoBanca.findMany({
      where: { attivo: true },
      orderBy: [{ banca: 'asc' }, { numeroConto: 'asc' }],
    })
    return NextResponse.json(conti)
  } catch (err) {
    console.error('[conti]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
