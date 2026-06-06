-- CreateEnum
CREATE TYPE "PrioritaTodo" AS ENUM ('URGENTE', 'ALTA', 'MEDIA', 'BASSA');

-- CreateEnum
CREATE TYPE "StatoTodo" AS ENUM ('APERTA', 'IN_CORSO', 'IN_ATTESA', 'CHIUSA');

-- CreateTable
CREATE TABLE "todo" (
    "id" BIGSERIAL NOT NULL,
    "titolo" VARCHAR(300) NOT NULL,
    "descrizione" TEXT,
    "priorita" "PrioritaTodo" NOT NULL DEFAULT 'MEDIA',
    "stato" "StatoTodo" NOT NULL DEFAULT 'APERTA',
    "committente_id" INTEGER,
    "cliente_id" INTEGER,
    "committente_libero" VARCHAR(200),
    "cliente_libero" VARCHAR(200),
    "scadenza" DATE,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "todo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "todo_stato_priorita_idx" ON "todo"("stato", "priorita");

-- CreateIndex
CREATE INDEX "todo_committente_id_idx" ON "todo"("committente_id");

-- AddForeignKey
ALTER TABLE "todo" ADD CONSTRAINT "todo_committente_id_fkey" FOREIGN KEY ("committente_id") REFERENCES "committente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo" ADD CONSTRAINT "todo_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
