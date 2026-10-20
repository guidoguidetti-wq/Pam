export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import StimeDettaglioEditor from '@/components/progetti/StimeDettaglioEditor'

export const metadata = { title: 'Dettaglio stime — PAM' }

export default async function StimeDettaglioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const progettoId = parseInt(id)
  if (isNaN(progettoId)) notFound()

  const [progetto, tipiAttivita, righe] = await Promise.all([
    prisma.progetto.findUnique({
      where: { id: progettoId },
      select: {
        id: true,
        nome: true,
        codice: true,
        tipoBudget: true,
        committente: { select: { ragioneSociale: true } },
        cliente: { select: { ragioneSociale: true } },
        tipiAttivita: { select: { tipoAttivitaId: true } },
        stimeInviate: true,
        stimeAccettate: true,
        stimeNote: true,
      },
    }),
    // Tutti i tipi attività (non solo quelli previsti dal progetto)
    prisma.tipoAttivita.findMany({
      where: { attivo: true },
      orderBy: { id: 'asc' },
      select: { id: true, codice: true, descrizione: true },
    }),
    prisma.progettoStimaDettaglio.findMany({
      where: { progettoId },
      orderBy: [{ ordine: 'asc' }, { id: 'asc' }],
      select: { id: true, tipoAttivitaId: true, descrizione: true, giorni: true },
    }),
  ])
  if (!progetto) notFound()

  return (
    <AppLayout>
      <div className="p-3">
        <StimeDettaglioEditor
          progetto={{
            id: progetto.id,
            nome: progetto.nome,
            codice: progetto.codice,
            committente: progetto.committente.ragioneSociale,
            cliente: progetto.cliente.ragioneSociale,
            tipiProgetto: progetto.tipiAttivita.map(t => t.tipoAttivitaId),
          }}
          tipiAttivita={tipiAttivita}
          statoIniziale={{
            stimeInviate: progetto.stimeInviate,
            stimeAccettate: progetto.stimeAccettate,
            stimeNote: progetto.stimeNote ?? '',
          }}
          righeIniziali={righe.map(r => ({
            tipoAttivitaId: String(r.tipoAttivitaId),
            descrizione: r.descrizione ?? '',
            giorni: String(r.giorni.toNumber()),
          }))}
        />
      </div>
    </AppLayout>
  )
}
