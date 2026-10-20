export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import { AttivitaTable } from '@/components/attivita/AttivitaTable'

export const metadata = { title: 'Attività progetto — PAM' }

export default async function AttivitaProgettoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const progettoId = parseInt(id)
  if (isNaN(progettoId)) notFound()

  const [progetto, committenti, tipiAttivita] = await Promise.all([
    prisma.progetto.findUnique({
      where: { id: progettoId },
      select: {
        nome: true,
        codice: true,
        committente: { select: { ragioneSociale: true } },
        cliente: { select: { ragioneSociale: true } },
      },
    }),
    prisma.committente.findMany({
      where: { attivo: true },
      orderBy: { ragioneSociale: 'asc' },
      select: { id: true, ragioneSociale: true },
    }),
    prisma.tipoAttivita.findMany({
      orderBy: { id: 'asc' },
    }),
  ])
  if (!progetto) notFound()

  return (
    <AppLayout>
      <div className="p-3 space-y-3">
        <div className="flex items-start gap-3">
          <Link href="/progetti" className="p-1.5 mt-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Attività del progetto</h1>
            <p className="text-sm">
              {progetto.codice && <span className="text-muted-foreground">[{progetto.codice}] </span>}
              <span className="font-medium">{progetto.nome}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {progetto.committente.ragioneSociale} › {progetto.cliente.ragioneSociale}
            </p>
          </div>
        </div>
        <AttivitaTable committenti={committenti} tipiAttivita={tipiAttivita} progettoId={progettoId} />
      </div>
    </AppLayout>
  )
}
