import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { vaultConfigSchema } from '@/lib/credenziali'

const select = { salt: true, iterazioni: true, chiaveCifrata: true } as const

// Configurazione della cassaforte (null se non ancora creata)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const cfg = await prisma.vaultConfig.findUnique({ where: { id: 1 }, select })
    return NextResponse.json(cfg)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

// Creazione (una sola volta): non sovrascrive mai una cassaforte esistente
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const parsed = vaultConfigSchema.safeParse(await req.json())
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const esistente = await prisma.vaultConfig.findUnique({ where: { id: 1 }, select: { id: true } })
    if (esistente) return NextResponse.json({ error: 'Cassaforte già configurata' }, { status: 409 })
    const cfg = await prisma.vaultConfig.create({ data: { id: 1, ...parsed.data }, select })
    return NextResponse.json(cfg, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

// Cambio master password: sostituisce la chiave cifrata solo se il client conosce quella attuale
const cambioSchema = z.object({ attuale: z.string().min(1), nuova: vaultConfigSchema })

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const parsed = cambioSchema.safeParse(await req.json())
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const { count } = await prisma.vaultConfig.updateMany({
      where: { id: 1, chiaveCifrata: parsed.data.attuale },
      data: parsed.data.nuova,
    })
    if (count === 0) return NextResponse.json({ error: 'Configurazione cambiata nel frattempo: ricaricare la pagina' }, { status: 409 })
    const cfg = await prisma.vaultConfig.findUnique({ where: { id: 1 }, select })
    return NextResponse.json(cfg)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
