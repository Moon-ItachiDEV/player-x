// « Ouvrir dans Discord » : le salon vocal dans l'appli Discord (ou le site). L'adresse est faite par le processus
// principal avec le serveur des Paramètres ; ici, seulement l'identifiant du salon.
import { useCallback } from 'react'
import type { DiscordChannel } from '@shared/types'
import { errorMessage, useToast } from '../ui/Toasts'

export function useOpenChannel(): (c: DiscordChannel) => void {
  const notify = useToast()
  return useCallback(
    (c: DiscordChannel) => {
      window.launcher
        .openDiscordChannel(c.id)
        .then((r) => {
          if (r === 'demo') notify(`Mode démo : Discord ouvrirait le salon « ${c.name} »`, { kind: 'info' })
        })
        .catch((e) => notify(errorMessage(e), { kind: 'error' }))
    },
    [notify]
  )
}
