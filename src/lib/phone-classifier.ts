export type PhoneType = "mobile" | "landline" | "unknown";

export interface PhoneClassification {
  type: PhoneType;
  canWhatsapp: boolean;
  whatsappUrl: string | null;
  label: string; // "WhatsApp", "Fijo", o ""
}

const UNKNOWN: PhoneClassification = {
  type: "unknown",
  canWhatsapp: false,
  whatsappUrl: null,
  label: "",
};

export function classifyPhone(phone: string | null | undefined): PhoneClassification {
  if (!phone) return UNKNOWN;

  // Limpiar: quitar espacios, guiones, paréntesis, puntos
  const clean = phone.replace(/[\s\-.()]/g, "");
  const digits = clean.startsWith("+") ? clean.slice(1) : clean;

  return tryUruguay(digits) ?? tryArgentina(digits) ?? UNKNOWN;
}

// ─── Uruguay (+598) ───────────────────────────────────────────────────────────
// Móvil:  598 9X XXX XXX  (9 + 7 dígitos más = 8 total después del código)
// Fijo:   598 2XXXXXXX (Montevideo), 3X, 4X, 6X, 7X (interior)
function tryUruguay(digits: string): PhoneClassification | null {
  let e164: string;

  if (digits.startsWith("598")) {
    e164 = digits;
  } else if (digits.startsWith("09") && digits.length >= 9) {
    // Formato local: 09X XXX XXX
    e164 = "598" + digits.slice(1);
  } else if (digits.startsWith("0") && digits.length >= 8 && digits.length <= 11) {
    // Fijo local: 02XXXXXXX, etc.
    e164 = "598" + digits.slice(1);
  } else {
    return null;
  }

  const afterCode = e164.slice(3); // dígitos después de 598

  // Móvil: empieza con 9 y tiene exactamente 8 dígitos
  if (/^9\d{7}$/.test(afterCode)) {
    return {
      type: "mobile",
      canWhatsapp: true,
      whatsappUrl: `https://wa.me/${e164}`,
      label: "WhatsApp",
    };
  }

  // Fijo: empieza con 2 (Montevideo) o 3, 4, 6, 7 (interior), 7-8 dígitos
  if (/^[234678]\d{6,7}$/.test(afterCode)) {
    return {
      type: "landline",
      canWhatsapp: false,
      whatsappUrl: null,
      label: "Fijo",
    };
  }

  return null;
}

// ─── Argentina (+54) ─────────────────────────────────────────────────────────
// Móvil:  54 9 XXX XXX XXXX
// Fijo:   54 XXX XXX XXXX
function tryArgentina(digits: string): PhoneClassification | null {
  if (!digits.startsWith("54")) return null;
  const afterCode = digits.slice(2);

  if (afterCode.startsWith("9")) {
    return {
      type: "mobile",
      canWhatsapp: true,
      whatsappUrl: `https://wa.me/${digits}`,
      label: "WhatsApp",
    };
  }

  if (afterCode.length >= 8) {
    return {
      type: "landline",
      canWhatsapp: false,
      whatsappUrl: null,
      label: "Fijo",
    };
  }

  return null;
}
