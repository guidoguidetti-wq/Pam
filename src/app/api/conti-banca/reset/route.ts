import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/conti-banca/reset?contoId=1  (omit to delete ALL)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const contoId = searchParams.get('contoId')

  try {
    const where = contoId ? { contoId: parseInt(contoId) } : {}

    const { count } = await prisma.movimentoBancario.deleteMany({ where })

    // Remove enti that have no movements left
    const orphans = await prisma.ente.findMany({
      where: { movimenti: { none: {} } },
      select: { id: true },
    })
    if (orphans.length > 0) {
      await prisma.ente.deleteMany({ where: { id: { in: orphans.map(e => e.id) } } })
    }

    return NextResponse.json({ deleted: count, entiRemoved: orphans.length })
  } catch (err) {
    console.error('[reset-banca]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
