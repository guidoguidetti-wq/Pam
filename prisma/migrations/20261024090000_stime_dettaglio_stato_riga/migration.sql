-- Inviata/Accettata per singola riga di stima (prima erano a livello progetto)
ALTER TABLE "progetto_stima_dettaglio" ADD COLUMN "inviata" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "progetto_stima_dettaglio" ADD COLUMN "accettata" BOOLEAN NOT NULL DEFAULT false;

-- Riporta sulle righe gli eventuali flag già impostati sul progetto
UPDATE "progetto_stima_dettaglio" d
SET "inviata" = p."stime_inviate", "accettata" = p."stime_accettate"
FROM "progetto" p
WHERE p."id" = d."progetto_id";

ALTER TABLE "progetto" DROP COLUMN "stime_inviate";
ALTER TABLE "progetto" DROP COLUMN "stime_accettate";
