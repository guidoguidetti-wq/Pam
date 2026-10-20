-- Dettaglio stime progetto (per tipo attività, anche di altre persone)
CREATE TABLE "progetto_stima_dettaglio" (
    "id" SERIAL NOT NULL,
    "progetto_id" INTEGER NOT NULL,
    "tipo_attivita_id" SMALLINT NOT NULL,
    "descrizione" TEXT,
    "giorni" DECIMAL(8,2) NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progetto_stima_dettaglio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "progetto_stima_dettaglio_progetto_id_idx" ON "progetto_stima_dettaglio"("progetto_id");
CREATE INDEX "progetto_stima_dettaglio_tipo_attivita_id_idx" ON "progetto_stima_dettaglio"("tipo_attivita_id");

ALTER TABLE "progetto_stima_dettaglio" ADD CONSTRAINT "progetto_stima_dettaglio_progetto_id_fkey" FOREIGN KEY ("progetto_id") REFERENCES "progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progetto_stima_dettaglio" ADD CONSTRAINT "progetto_stima_dettaglio_tipo_attivita_id_fkey" FOREIGN KEY ("tipo_attivita_id") REFERENCES "tipo_attivita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
