-- Marca los productos que apago el boton de pausar todo, para poder
-- reactivar solo esos y no los que alguien pauso a mano.
ALTER TABLE "Product" ADD COLUMN "pausedAt" TIMESTAMP(3);
