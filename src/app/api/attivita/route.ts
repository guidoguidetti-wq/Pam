import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { coloreCommittente } from '@/lib/utils'
import { getTariffa } from '@/lib/tariffe'

function minsToHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
function epochTimeToMins(d: Date): number {
  const [h, m] = d.toISOString().substring(11, 16).split(':').map(Number)
  return h * 60 + m
}

const schema = z
  .object({
    dataAttivita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    oraInizio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    oraFine: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    oreErogate: z.number().int().positive().optional(),
    committenteId: z.number().int().positive(),
    clienteId: z.number().int().positive().nullable().optional(),
    progettoId: z.number().int().positive().nullable().optional(),
    tipoAttivitaId: z.number().int().positive(),
    descrizione: z.string().nullable().optional(),
    noteInterne: z.string().nullable().optional(),
    fatturabile: z.boolean().default(true),
    prezzoUnitario: z.number().nullable().optional(),
    valoreAttivita: z.number().nullable().optional(),
  })
  .refine((d) => (d.oraInizio && d.oraFine) || typeof d.oreErogate === 'number', {
    message: 'Specificare ora inizio/fine oppure ore erogate',
  })
  .refine((d) => !(d.oraInizio && d.oraFine) || d.oraFine > d.oraInizio, {
    message: 'Ora fine deve essere successiva a ora inizio', path: ['oraFine'],
  })

type AttivitaWithRel = {
  id: bigint
  dataAttivita: Date
  oraInizio: Date
  oraFine: Date
  oreErogate: number | null
  committenteId: number
  clienteId: number | null
  progettoId: number | null
  tipoAttivitaId: number
  descrizione: string | null
  noteInterne: string | null
  fatturabile: boolean
  prezzoUnitario: { toString(): string } | null
  valoreAttivita: { toString(): string } | null
  committente: { ragioneSociale: string }
  cliente: { ragioneSociale: string } | null
  tipoAttivita: { codice: string; descrizione: string }
  progetto: { nome: string } | null
  spese: { importoTotale: { toString(): string } }[]
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
    prezzoUnitario: row.prezzoUnitario ? parseFloat(row.prezzoUnitario.toString()) : null,
    valoreAttivita: row.valoreAttivita ? parseFloat(row.valoreAttivita.toString()) : null,
    totaleSpese: row.spese.reduce((sum, s) => sum + parseFloat(s.importoTotale.toString()), 0),
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
  spese: { select: { importoTotale: true } },
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const committenteId = searchParams.get('committente_id')

  const attivita = await prisma.attivita.findMany({
    where: {
      ...(from ? { dataAttivita: { gte: new Date(from) } } : {}),
      ...(to ? { dataAttivita: { lte: new Date(to) } } : {}),
      ...(committenteId ? { committenteId: parseInt(committenteId) } : {}),
    },
    include: includeRelations,
    orderBy: [{ dataAttivita: 'asc' }, { oraInizio: 'asc' }],
  })
  return NextResponse.json(attivita.map(serialize))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { dataAttivita, oraInizio, oraFine, oreErogate, prezzoUnitario, valoreAttivita, ...rest } = parsed.data

  try {
    let finalOraInizio: string, finalOraFine: string, finalOreErogate: number

    if (oraInizio && oraFine) {
      finalOraInizio = oraInizio; finalOraFine = oraFine
      const [hi, mi] = oraInizio.split(':').map(Number)
      const [hf, mf] = oraFine.split(':').map(Number)
      finalOreErogate = (hf * 60 + mf) - (hi * 60 + mi)
    } else {
      finalOreErogate = oreErogate!
      const lastAct = await prisma.attivita.findFirst({
        where: { dataAttivita: new Date(dataAttivita) },
        orderBy: { oraFine: 'desc' }, select: { oraFine: true },
      })
      const startMins = lastAct ? epochTimeToMins(lastAct.oraFine) : 9 * 60
      finalOraInizio = minsToHHMM(startMins)
      finalOraFine = minsToHHMM(startMins + finalOreErogate)
    }

    // Risolvi prezzo dal listino se non fornito
    let finalPrezzo = prezzoUnitario ?? null
    if (finalPrezzo === null || finalPrezzo === undefined) {
      const tariffa = await getTariffa(
        rest.committenteId,
        rest.clienteId ?? null,
        rest.tipoAttivitaId,
        'ORARIO',
        new Date(dataAttivita)
      )
      finalPrezzo = tariffa ? parseFloat(tariffa.toString()) : null
    }

    // Calcola valore se non fornito
    const finalValore = valoreAttivita ?? (finalPrezzo !== null ? finalPrezzo * (finalOreErogate / 60) : null)

    const result = await prisma.attivita.create({
      data: {
        ...rest,
        dataAttivita: new Date(dataAttivita),
        oraInizio: new Date(`1970-01-01T${finalOraInizio}:00.000Z`),
        oraFine: new Date(`1970-01-01T${finalOraFine}:00.000Z`),
        oreErogate: finalOreErogate,
        prezzoUnitario: finalPrezzo,
        valoreAttivita: finalValore,
      },
      include: includeRelations,
    })
    return NextResponse.json(serialize(result), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
