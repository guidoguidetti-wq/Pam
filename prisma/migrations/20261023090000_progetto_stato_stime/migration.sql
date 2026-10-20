-- Stato del dettaglio stime: inviate, accettate, note
ALTER TABLE "progetto" ADD COLUMN "stime_inviate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "progetto" ADD COLUMN "stime_accettate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "progetto" ADD COLUMN "stime_note" TEXT;
