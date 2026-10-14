import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildSqlDump, type Row } from '@/lib/backup-sql'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const last = await prisma.backupLog.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(last)
}

export const maxDuration = 60

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `pam_backup_${ts}.sql`

  try {
    // Dump completo: struttura (tabelle, enum, vincoli, indici, funzioni…) + dati di tutte le tabelle
    const { sql } = await buildSqlDump((q) => prisma.$queryRawUnsafe<Row[]>(q))
    const fileSizeBytes = Buffer.byteLength(sql, 'utf-8')

    // Registra nel log (senza percorso fisico — il file va al browser)
    await prisma.backupLog.create({
      data: { filename, fileSizeBytes, status: 'success' },
    })

    return new Response(sql, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
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
