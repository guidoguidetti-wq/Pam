import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  attivitaId: z.string().regex(/^\d+$/, 'ID non valido'),
  tipoSpesa: z.enum(['KM', 'AUTOSTRADA', 'MEZZI', 'VITTO', 'ALLOGGIO', 'ALTRO']),
  descrizione: z.string().max(300).nullable().optional(),
  quantita: z.number().nullable().optional(),
  importoUnitario: z.number().nullable().optional(),
  importoTotale: z.number().positive('Importo obbligatorio'),
  valuta: z.string().length(3).default('EUR'),
  dataSpesa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido'),
  rimborsoRichiesto: z.boolean().default(true),
})

function serializeSpesa(s: {
  id: bigint
  attivitaId: bigint
  tipoSpesa: string
  descrizione: string | null
  quantita: { toString(): string } | null
  importoUnitario: { toString(): string } | null
  importoTotale: { toString(): string }
  valuta: string
  dataSpesa: Date
  rimborsoRichiesto: boolean
  createdAt: Date
  allegati?: { id: bigint; spesaId: bigint | null; attivitaId: bigint | null; nomeFile: string; tipoMime: string | null; dimensioneBytes: number | null; storageKey: string; storageUrl: string | null; createdAt: Date }[]
}) {
  return {
    ...s,
    id: s.id.toString(),
    attivitaId: s.attivitaId.toString(),
    quantita: s.quantita ? parseFloat(s.quantita.toString()) : null,
    importoUnitario: s.importoUnitario ? parseFloat(s.importoUnitario.toString()) : null,
    importoTotale: parseFloat(s.importoTotale.toString()),
    dataSpesa: s.dataSpesa.toISOString().split('T')[0],
    allegati: (s.allegati ?? []).map((a) => ({
      ...a,
      id: a.id.toString(),
      spesaId: a.spesaId?.toString() ?? null,
      attivitaId: a.attivitaId?.toString() ?? null,
    })),
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const attivitaId = searchParams.get('attivita_id')
  if (!attivitaId) return NextResponse.json({ error: 'attivita_id richiesto' }, { status: 400 })

  const spese = await prisma.spesa.findMany({
    where: { attivitaId: BigInt(attivitaId) },
    include: { allegati: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(spese.map(serializeSpesa))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.spesa.create({
      data: {
        attivitaId: BigInt(parsed.data.attivitaId),
        tipoSpesa: parsed.data.tipoSpesa,
        descrizione: parsed.data.descrizione ?? null,
        quantita: parsed.data.quantita ?? null,
        importoUnitario: parsed.data.importoUnitario ?? null,
        importoTotale: parsed.data.importoTotale,
        valuta: parsed.data.valuta,
        dataSpesa: new Date(parsed.data.dataSpesa),
        rimborsoRichiesto: parsed.data.rimborsoRichiesto,
      },
      include: { allegati: true },
    })
    return NextResponse.json(serializeSpesa(result), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
