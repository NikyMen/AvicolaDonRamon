const base = $('Resolver contacto Don Ramon').first().json;
const rawResponse = $input.first().json ?? {};

let response = rawResponse;

if (typeof rawResponse.data === 'string') {
  try {
    response = JSON.parse(rawResponse.data);
  } catch {
    response = rawResponse;
  }
} else if (rawResponse.data && typeof rawResponse.data === 'object') {
  response = rawResponse.data;
}

const contact = response;

const fields = Array.isArray(contact.custom_fields_values)
  ? contact.custom_fields_values
  : [];

const getFieldValue = (field) => {
  if (!Array.isArray(field?.values)) return '';

  const value = field.values.find(
    (item) => item?.value !== undefined && item?.value !== null
  );

  return String(value?.value ?? value?.enum_name ?? '').trim();
};

const phoneField = fields.find(
  (field) =>
    field?.field_code === 'PHONE' ||
    /telefono|teléfono|phone/i.test(
      String(field?.field_name ?? field?.name ?? '')
    )
);

const commercialField = fields.find((field) =>
  /condicion comercial|condición comercial/i.test(
    String(field?.field_name ?? field?.name ?? '')
  )
);

const phone = getFieldValue(phoneField)
  .replace(/[^\d+]/g, '')
  .trim();

const commercialCondition = getFieldValue(commercialField);

// Solo es confiable si Kommo devolvió el contacto: un campo vacío equivale a
// "Sin definir", pero si la consulta falló la web conserva la condición que ya
// tenía (así un error de Kommo no saca a nadie de cuenta corriente).
const commercialConditionKnown = Boolean(contact?.id);

return [
  {
    json: {
      ...base,
      phone,
      name: base.name || contact?.name || '',
      contactId: String(contact?.id ?? base.contactId ?? ''),
      commercialCondition,
      commercialConditionKnown,
      sessionId: 'lead:' + base.leadId,
      currentLead: base.currentLead,
    },
  },
];
