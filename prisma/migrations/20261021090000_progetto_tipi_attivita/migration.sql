-- Tipi attività ammessi per progetto (relazione molti-a-molti)
CREATE TABLE "progetto_tipo_attivita" (
    "progetto_id" INTEGER NOT NULL,
    "tipo_attivita_id" SMALLINT NOT NULL,

    CONSTRAINT "progetto_tipo_attivita_pkey" PRIMARY KEY ("progetto_id","tipo_attivita_id")
);

CREATE INDEX "progetto_tipo_attivita_tipo_attivita_id_idx" ON "progetto_tipo_attivita"("tipo_attivita_id");

ALTER TABLE "progetto_tipo_attivita" ADD CONSTRAINT "progetto_tipo_attivita_progetto_id_fkey" FOREIGN KEY ("progetto_id") REFERENCES "progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progetto_tipo_attivita" ADD CONSTRAINT "progetto_tipo_attivita_tipo_attivita_id_fkey" FOREIGN KEY ("tipo_attivita_id") REFERENCES "tipo_attivita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Popola dai dati esistenti: tipi con stima + tipi delle attività già collegate al progetto
INSERT INTO "progetto_tipo_attivita" ("progetto_id", "tipo_attivita_id")
SELECT "progetto_id", "tipo_attivita_id" FROM "progetto_stima"
UNION
SELECT "progetto_id", "tipo_attivita_id" FROM "attivita" WHERE "progetto_id" IS NOT NULL
ON CONFLICT DO NOTHING;
