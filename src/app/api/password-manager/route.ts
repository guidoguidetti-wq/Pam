import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { credenzialeSchema, credenzialeInclude } from '@/lib/credenziali'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const clienteId = new URL(req.url).searchParams.get('cliente_id')

  try {
    const credenziali = await prisma.credenziale.findMany({
      where: clienteId ? { clienteId: parseInt(clienteId) } : undefined,
      orderBy: [{ cliente: { ragioneSociale: 'asc' } }, { sezione: 'asc' }, { ambiente: 'asc' }],
      include: credenzialeInclude,
    })
    return NextResponse.json(credenziali)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = credenzialeSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { voci, ...rest } = parsed.data

  try {
    const result = await prisma.credenziale.create({
      data: {
        ...rest,
        voci: {
          create: voci.map((v, i) => ({
            descrizione: v.descrizione ?? null,
            utente: v.utente ?? null,
            password: v.password ?? null,
            ordine: i,
          })),
        },
      },
      include: credenzialeInclude,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
