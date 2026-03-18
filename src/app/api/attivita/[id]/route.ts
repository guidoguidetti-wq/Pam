import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { coloreCommittente } from '@/lib/utils'

// ── helpers ────────────────────────────────────────────────────────────────

function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function epochTimeToMins(d: Date): number {
  const [h, m] = d.toISOString().substring(11, 16).split(':').map(Number)
  return h * 60 + m
}

// ── schema ─────────────────────────────────────────────────────────────────

const schema = z
  .object({
    dataAttivita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido'),
    oraInizio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    oraFine: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    oreErogate: z.number().int().positive().optional(),
    committenteId: z.number().int().positive(),
    clienteId: z.number().int().positive(),
    progettoId: z.number().int().positive().nullable().optional(),
    tipoAttivitaId: z.number().int().positive(),
    descrizione: z.string().nullable().optional(),
    noteInterne: z.string().nullable().optional(),
    fatturabile: z.boolean().default(true),
  })
  .refine(
    (d) => (d.oraInizio && d.oraFine) || typeof d.oreErogate === 'number',
    { message: 'Specificare ora inizio/fine oppure ore erogate' }
  )
  .refine(
    (d) => !(d.oraInizio && d.oraFine) || d.oraFine > d.oraInizio,
    { message: 'Ora fine deve essere successiva a ora inizio', path: ['oraFine'] }
  )

// ── serializer ─────────────────────────────────────────────────────────────

type AttivitaWithRel = {
  id: bigint
  dataAttivita: Date
  oraInizio: Date
  oraFine: Date
  oreErogate: number | null
  committenteId: number
  clienteId: number
  progettoId: number | null
  tipoAttivitaId: number
  descrizione: string | null
  noteInterne: string | null
  fatturabile: boolean
  committente: { ragioneSociale: string }
  cliente: { ragioneSociale: string }
  tipoAttivita: { codice: string; descrizione: string }
  progetto: { nome: string } | null
}

function serialize(row: AttivitaWithRel) {
  const dataStr = row.dataAttivita.toISOString().split('T')[0]
  const oraInizio = row.oraInizio.toISOString().substring(11, 16)
  const oraFine = row.oraFine.toISOString().substring(11, 16)
  return {
    id: row.id.toString(),
    dataAttivita: dataStr,
    oraInizio,
    oraFine,
    oreErogate: row.oreErogate,
    committenteId: row.committenteId,
    clienteId: row.clienteId,
    progettoId: row.progettoId,
    tipoAttivitaId: row.tipoAttivitaId,
    descrizione: row.descrizione,
    noteInterne: row.noteInterne,
    fatturabile: row.fatturabile,
    committente: row.committente,
    cliente: row.cliente,
    tipoAttivita: row.tipoAttivita,
    progetto: row.progetto,
    start: `${dataStr}T${oraInizio}`,
    end: `${dataStr}T${oraFine}`,
    title: `${row.committente.ragioneSociale} — ${row.tipoAttivita.codice}${row.descrizione ? `: ${row.descrizione}` : ''}`,
    backgroundColor: coloreCommittente(row.committenteId),
    borderColor: coloreCommittente(row.committenteId),
    textColor: '#fff',
  }
}

const includeRelations = {
  committente: { select: { ragioneSociale: true } },
  cliente: { select: { ragioneSociale: true } },
  tipoAttivita: { select: { codice: true, descrizione: true } },
  progetto: { select: { nome: true } },
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  try {
    const row = await prisma.attivita.findUnique({
      where: { id: BigInt(id) },
      include: includeRelations,
    })
    if (!row) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })
    return NextResponse.json(serialize(row))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

// ── PUT ────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { dataAttivita, oraInizio, oraFine, oreErogate, ...rest } = parsed.data

  try {
    let finalOraInizio: string
    let finalOraFine: string
    let finalOreErogate: number

    if (oraInizio && oraFine) {
      finalOraInizio = oraInizio
      finalOraFine = oraFine
      const [hi, mi] = oraInizio.split(':').map(Number)
      const [hf, mf] = oraFine.split(':').map(Number)
      finalOreErogate = (hf * 60 + mf) - (hi * 60 + mi)
    } else {
      finalOreErogate = oreErogate!
      // Cerca ultima attività del giorno escludendo quella corrente
      const lastAct = await prisma.attivita.findFirst({
        where: { dataAttivita: new Date(dataAttivita), NOT: { id: BigInt(id) } },
        orderBy: { oraFine: 'desc' },
        select: { oraFine: true },
      })
      const startMins = lastAct ? epochTimeToMins(lastAct.oraFine) : 9 * 60
      finalOraInizio = minsToHHMM(startMins)
      finalOraFine = minsToHHMM(startMins + finalOreErogate)
    }

    const result = await prisma.attivita.update({
      where: { id: BigInt(id) },
      data: {
        ...rest,
        dataAttivita: new Date(dataAttivita),
        oraInizio: new Date(`1970-01-01T${finalOraInizio}:00.000Z`),
        oraFine: new Date(`1970-01-01T${finalOraFine}:00.000Z`),
        oreErogate: finalOreErogate,
      },
      include: includeRelations,
    })
    return NextResponse.json(serialize(result))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.attivita.delete({ where: { id: BigInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
