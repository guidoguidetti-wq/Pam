-- DropForeignKey
ALTER TABLE "attivita" DROP CONSTRAINT "attivita_cliente_id_fkey";

-- AlterTable
ALTER TABLE "attivita" ADD COLUMN     "prezzo_unitario" DECIMAL(10,4),
ADD COLUMN     "valore_attivita" DECIMAL(10,2),
ALTER COLUMN "cliente_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "attivita" ADD CONSTRAINT "attivita_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
