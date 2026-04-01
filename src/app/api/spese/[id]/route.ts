import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  tipoSpesa: z.enum(['KM', 'AUTOSTRADA', 'MEZZI', 'VITTO', 'ALLOGGIO', 'ALTRO']),
  descrizione: z.string().max(300).nullable().optional(),
  quantita: z.number().nullable().optional(),
  importoUnitario: z.number().nullable().optional(),
  importoTotale: z.number().positive('Importo obbligatorio'),
  dataSpesa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido'),
  rimborsoRichiesto: z.boolean(),
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
  allegati: { id: bigint; spesaId: bigint | null; attivitaId: bigint | null; nomeFile: string; tipoMime: string | null; dimensioneBytes: number | null; storageKey: string; storageUrl: string | null; createdAt: Date }[]
}) {
  return {
    ...s,
    id: s.id.toString(),
    attivitaId: s.attivitaId.toString(),
    quantita: s.quantita ? parseFloat(s.quantita.toString()) : null,
    importoUnitario: s.importoUnitario ? parseFloat(s.importoUnitario.toString()) : null,
    importoTotale: parseFloat(s.importoTotale.toString()),
    dataSpesa: s.dataSpesa.toISOString().split('T')[0],
    allegati: s.allegati.map((a) => ({
      ...a,
      id: a.id.toString(),
      spesaId: a.spesaId?.toString() ?? null,
      attivitaId: a.attivitaId?.toString() ?? null,
    })),
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.spesa.update({
      where: { id: BigInt(id) },
      data: {
        tipoSpesa: parsed.data.tipoSpesa,
        descrizione: parsed.data.descrizione ?? null,
        quantita: parsed.data.quantita ?? null,
        importoUnitario: parsed.data.importoUnitario ?? null,
        importoTotale: parsed.data.importoTotale,
        dataSpesa: new Date(parsed.data.dataSpesa),
        rimborsoRichiesto: parsed.data.rimborsoRichiesto,
      },
      include: { allegati: true },
    })
    return NextResponse.json(serializeSpesa(result))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.spesa.delete({ where: { id: BigInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
