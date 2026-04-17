import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const last = await prisma.backupLog.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(last)
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `pam_backup_${ts}.json`

  try {
    const [tipiAttivita, committenti, clienti, listino, progetti, progettoStime, attivita, spese, allegati] =
      await Promise.all([
        prisma.tipoAttivita.findMany(),
        prisma.committente.findMany(),
        prisma.cliente.findMany(),
        prisma.listino.findMany(),
        prisma.progetto.findMany(),
        prisma.progettoStima.findMany(),
        prisma.attivita.findMany(),
        prisma.spesa.findMany(),
        prisma.allegato.findMany(),
      ])

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      tables: { tipiAttivita, committenti, clienti, listino, progetti, progettoStime, attivita, spese, allegati },
    }

    const json = JSON.stringify(backup, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
    const fileSizeBytes = Buffer.byteLength(json, 'utf-8')

    // Registra nel log (senza percorso fisico — il file va al browser)
    await prisma.backupLog.create({
      data: { filename, fileSizeBytes, status: 'success' },
    })

    return new Response(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileSizeBytes),
      },
    })
  } catch (err) {
    console.error('Backup error:', err)
    try {
      await prisma.backupLog.create({
        data: { filename, status: 'error', errorMessage: String(err) },
      })
    } catch {}
    return NextResponse.json({ error: 'Errore durante il backup' }, { status: 500 })
  }
}
