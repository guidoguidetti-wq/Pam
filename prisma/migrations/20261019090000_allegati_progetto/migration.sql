-- Allegati di progetto: collegamento al progetto, descrizione e data
ALTER TABLE "allegato" ADD COLUMN "progetto_id" INTEGER;
ALTER TABLE "allegato" ADD COLUMN "descrizione" TEXT;
ALTER TABLE "allegato" ADD COLUMN "data_allegato" DATE;

CREATE INDEX "allegato_progetto_id_idx" ON "allegato"("progetto_id");

ALTER TABLE "allegato" ADD CONSTRAINT "allegato_progetto_id_fkey" FOREIGN KEY ("progetto_id") REFERENCES "progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
