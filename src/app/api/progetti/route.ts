import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { progettoSchema, progettoInclude, conOrePerTipo, datiProgetto } from '@/lib/progetti'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const committenteId = searchParams.get('committente_id')
  const clienteId = searchParams.get('cliente_id')

  try {
    const progetti = await prisma.progetto.findMany({
      where: {
        ...(committenteId ? { committenteId: parseInt(committenteId) } : {}),
        ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
      },
      orderBy: [{ committente: { ragioneSociale: 'asc' } }, { nome: 'asc' }],
      include: progettoInclude,
    })
    return NextResponse.json(await conOrePerTipo(progetti))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = progettoSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.progetto.create({
      data: datiProgetto(parsed.data),
      include: progettoInclude,
    })
    const [arricchito] = await conOrePerTipo([result])
    return NextResponse.json(arricchito, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
