import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTariffa } from '@/lib/tariffe'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const committenteId = parseInt(searchParams.get('committente_id') ?? '')
  const clienteIdParam = searchParams.get('cliente_id')
  const tipoAttivitaIdParam = searchParams.get('tipo_attivita_id')
  const dataParam = searchParams.get('data')

  if (!committenteId) return NextResponse.json({ tariffa: null })

  const clienteId = clienteIdParam ? parseInt(clienteIdParam) : null
  const tipoAttivitaId = tipoAttivitaIdParam ? parseInt(tipoAttivitaIdParam) : null
  const data = dataParam ? new Date(dataParam) : new Date()

  const tariffa = await getTariffa(committenteId, clienteId, tipoAttivitaId, 'ORARIO', data)
  return NextResponse.json({ tariffa: tariffa ? parseFloat(tariffa.toString()) : null })
}
