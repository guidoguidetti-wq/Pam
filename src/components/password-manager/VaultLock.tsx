'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { creaVault, sbloccaVault, cambiaMasterPassword, type VaultConfigDati } from '@/lib/vault-crypto'

const MIN_LEN = 12

const nuovaPasswordSchema = z
  .object({
    nuova: z.string().min(MIN_LEN, `Almeno ${MIN_LEN} caratteri`),
    conferma: z.string(),
  })
  .refine(d => d.nuova === d.conferma, { message: 'Le password non coincidono', path: ['conferma'] })

const setupSchema = nuovaPasswordSchema.and(
  z.object({ consapevole: z.literal(true, { errorMap: () => ({ message: 'Conferma di aver capito' }) }) })
)
const sbloccoSchema = z.object({ master: z.string().min(1, 'Inserire la master password') })
const cambioSchema = nuovaPasswordSchema.and(z.object({ attuale: z.string().min(1, 'Inserire la password attuale') }))

type Props = { config: VaultConfigDati | null; onSbloccato: (key: CryptoKey, config: VaultConfigDati) => void }

export default function VaultLock({ config, onSbloccato }: Props) {
  return config ? <Sblocco config={config} onSbloccato={onSbloccato} /> : <Setup onSbloccato={onSbloccato} />
}

function Riquadro({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto mt-8 border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2 font-semibold">
        <Lock className="h-4 w-4" />
        {titolo}
      </div>
      {children}
    </div>
  )
}

function Sblocco({ config, onSbloccato }: { config: VaultConfigDati; onSbloccato: Props['onSbloccato'] }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof sbloccoSchema>>({
    resolver: zodResolver(sbloccoSchema),
  })

  async function onSubmit({ master }: z.infer<typeof sbloccoSchema>) {
    try {
      onSbloccato(await sbloccaVault(config, master), config)
    } catch {
      setError('master', { message: 'Master password errata' })
    }
  }

  return (
    <Riquadro titolo="Cassaforte bloccata">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" autoComplete="off">
        <div className="space-y-1">
          <Label>Master password</Label>
          <Input type="password" autoFocus {...register('master')} />
          {errors.master && <p className="text-xs text-destructive">{errors.master.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sblocco…' : 'Sblocca'}
        </Button>
      </form>
    </Riquadro>
  )
}

function Setup({ onSbloccato }: { onSbloccato: Props['onSbloccato'] }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(setupSchema),
  })

  async function onSubmit({ nuova }: z.infer<typeof setupSchema>) {
    const { config, key } = await creaVault(nuova)
    const res = await fetch('/api/password-manager/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) {
      toast.error((await res.json()).error ?? 'Errore creazione cassaforte')
      return
    }
    toast.success('Cassaforte creata')
    onSbloccato(key, await res.json())
  }

  return (
    <Riquadro titolo="Imposta la master password">
      <p className="text-sm text-muted-foreground">
        Le credenziali vengono cifrate nel browser con questa password prima di essere salvate:
        né il database né il server possono leggerle.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" autoComplete="off">
        <div className="space-y-1">
          <Label>Master password</Label>
          <Input type="password" autoFocus autoComplete="new-password" {...register('nuova')} />
          {errors.nuova && <p className="text-xs text-destructive">{errors.nuova.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Conferma</Label>
          <Input type="password" autoComplete="new-password" {...register('conferma')} />
          {errors.conferma && <p className="text-xs text-destructive">{errors.conferma.message}</p>}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" {...register('consapevole')} />
          <span>
            Ho capito che <strong>la master password non è recuperabile</strong>: se la perdo, le credenziali
            salvate non potranno più essere decifrate.
          </span>
        </label>
        {errors.consapevole && <p className="text-xs text-destructive">{errors.consapevole.message}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creazione…' : 'Crea cassaforte'}
        </Button>
      </form>
    </Riquadro>
  )
}

export function CambiaMasterDialog({
  config,
  onCambiata,
}: {
  config: VaultConfigDati
  onCambiata: (config: VaultConfigDati) => void
}) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof cambioSchema>>({
    resolver: zodResolver(cambioSchema),
  })

  async function onSubmit({ attuale, nuova }: z.infer<typeof cambioSchema>) {
    let nuovaCfg: VaultConfigDati
    try {
      nuovaCfg = await cambiaMasterPassword(config, attuale, nuova)
    } catch {
      setError('attuale', { message: 'Password attuale errata' })
      return
    }
    const res = await fetch('/api/password-manager/vault', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attuale: config.chiaveCifrata, nuova: nuovaCfg }),
    })
    if (!res.ok) {
      toast.error((await res.json()).error ?? 'Errore cambio password')
      return
    }
    toast.success('Master password cambiata')
    onCambiata(await res.json())
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { reset(); setOpen(true) }}>
        <ShieldCheck className="h-4 w-4 mr-1.5" />
        Master password
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambia master password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" autoComplete="off">
            <div className="space-y-1">
              <Label>Password attuale</Label>
              <Input type="password" {...register('attuale')} />
              {errors.attuale && <p className="text-xs text-destructive">{errors.attuale.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Nuova password</Label>
              <Input type="password" autoComplete="new-password" {...register('nuova')} />
              {errors.nuova && <p className="text-xs text-destructive">{errors.nuova.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Conferma nuova password</Label>
              <Input type="password" autoComplete="new-password" {...register('conferma')} />
              {errors.conferma && <p className="text-xs text-destructive">{errors.conferma.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvataggio…' : 'Cambia'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
