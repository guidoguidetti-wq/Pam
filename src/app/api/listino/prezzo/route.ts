import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTariffa } from '@/lib/tariffe'

type TipoVoce = 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const committenteId = parseInt(searchParams.get('committente_id') ?? '')
  const clienteIdParam = searchParams.get('cliente_id')
  const tipoAttivitaIdParam = searchParams.get('tipo_attivita_id')
  const dataParam = searchParams.get('data')
  const tipoVoceParam = searchParams.get('tipo_voce') ?? 'ORARIO'

  if (!committenteId) return NextResponse.json({ tariffa: null })

  const clienteId = clienteIdParam ? parseInt(clienteIdParam) : null
  const data = dataParam ? new Date(dataParam) : new Date()

  const validTipiVoce: TipoVoce[] = ['ORARIO', 'GIORNALIERO', 'KM', 'RIMBORSO']
  const tipoVoce: TipoVoce = validTipiVoce.includes(tipoVoceParam as TipoVoce)
    ? (tipoVoceParam as TipoVoce)
    : 'ORARIO'

  // For KM type, tipoAttivitaId is not meaningful
  const tipoAttivitaId =
    tipoVoce === 'KM' ? null : (tipoAttivitaIdParam ? parseInt(tipoAttivitaIdParam) : null)

  const tariffa = await getTariffa(committenteId, clienteId, tipoAttivitaId, tipoVoce, data)
  return NextResponse.json({ tariffa: tariffa ? parseFloat(tariffa.toString()) : null })
}
