-- Nuovo tipo attività: VIA → Tempo Viaggio
INSERT INTO "tipo_attivita" ("codice", "descrizione", "attivo")
VALUES ('VIA', 'Tempo Viaggio', true)
ON CONFLICT ("codice") DO NOTHING;
