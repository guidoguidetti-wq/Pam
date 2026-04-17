import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import path from 'path'
import fs from 'fs/promises'

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

  let filename = ''
  let filePath = ''

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

    // BigInt → string per JSON.stringify
    const json = JSON.stringify(backup, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    filename = `pam_backup_${ts}.json`

    const backupsDir = path.join(process.cwd(), 'backups')
    await fs.mkdir(backupsDir, { recursive: true })
    filePath = path.join(backupsDir, filename)
    await fs.writeFile(filePath, json, 'utf-8')

    const fileSizeBytes = Buffer.byteLength(json, 'utf-8')

    const log = await prisma.backupLog.create({
      data: { filename, filePath, fileSizeBytes, status: 'success' },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    console.error('Backup error:', err)
    try {
      await prisma.backupLog.create({
        data: {
          filename: filename || 'errore',
          filePath: filePath || null,
          status: 'error',
          errorMessage: String(err),
        },
      })
    } catch {}
    return NextResponse.json({ error: 'Errore durante il backup' }, { status: 500 })
  }
}
