-- Distinguir intentos sin pago de cancelaciones operativas o reintegros.
ALTER TYPE "OrderStatus" ADD VALUE 'no_pagado';
