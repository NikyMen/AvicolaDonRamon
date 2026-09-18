/** Política explícita: nunca inferir la escala a partir del tamaño del precio. */
export function cuanticoPricePolicy(env: Record<string, string | undefined>) {
  const divisor = Number(env.CUANTICO_PRICE_DIVISOR ?? "1");
  const maxChangePercent = Number(env.CUANTICO_MAX_PRICE_CHANGE_PERCENT ?? "35");
  if (![1, 10].includes(divisor)) throw new Error("CUANTICO_PRICE_DIVISOR debe ser 1 o 10.");
  if (!Number.isFinite(maxChangePercent) || maxChangePercent <= 0 || maxChangePercent > 100) {
    throw new Error("CUANTICO_MAX_PRICE_CHANGE_PERCENT debe ser mayor a 0 y hasta 100.");
  }
  return { divisor, maxChangePercent };
}

export function validatedCuanticoPrice(rawPrice: number, previous: number | undefined, policy: ReturnType<typeof cuanticoPricePolicy>) {
  const price = Math.round(rawPrice / policy.divisor);
  if (!Number.isSafeInteger(price) || price <= 0 || price > 2147483647) {
    throw new Error("Precio fuera del rango permitido.");
  }
  if (previous !== undefined && (!Number.isFinite(previous) || previous <= 0)) {
    throw new Error("Precio anterior inválido; requiere revisión.");
  }
  if (previous !== undefined && Math.abs(price - previous) / previous * 100 > policy.maxChangePercent) {
    throw new Error(`Variación superior al ${policy.maxChangePercent}%: ${previous} → ${price}.`);
  }
  return price;
}
