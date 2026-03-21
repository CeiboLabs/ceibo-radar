export interface StructuredLocation {
  city: string | null;
  region: string | null;
  country: string;
}

// Uruguay departments (lowercase for matching)
const DEPARTMENTS: Record<string, string> = {
  artigas: "Artigas",
  canelones: "Canelones",
  "cerro largo": "Cerro Largo",
  colonia: "Colonia",
  durazno: "Durazno",
  flores: "Flores",
  florida: "Florida",
  lavalleja: "Lavalleja",
  maldonado: "Maldonado",
  montevideo: "Montevideo",
  paysandú: "Paysandú",
  paysandu: "Paysandú",
  "río negro": "Río Negro",
  "rio negro": "Río Negro",
  rivera: "Rivera",
  rocha: "Rocha",
  salto: "Salto",
  "san josé": "San José",
  "san jose": "San José",
  soriano: "Soriano",
  tacuarembó: "Tacuarembó",
  tacuarembo: "Tacuarembó",
  "treinta y tres": "Treinta y Tres",
};

// Known Montevideo neighborhoods → city=neighborhood, region=Montevideo
const MONTEVIDEO_NEIGHBORHOODS = new Set([
  "pocitos", "punta carretas", "centro", "cordón", "cordon",
  "palermo", "ciudad vieja", "buceo", "malvín", "malvin",
  "prado", "sayago", "parque batlle", "goes", "la blanqueada",
  "tres cruces", "aguada", "union", "unión",
]);

// Known Maldonado cities
const MALDONADO_CITIES = new Set([
  "punta del este", "maldonado", "san carlos", "piriápolis",
  "piriapolis", "la barra", "josé ignacio", "jose ignacio",
]);

export function parseLocation(raw: string): StructuredLocation {
  if (!raw) return { city: null, region: null, country: "Uruguay" };
  const n = raw.toLowerCase().trim();

  // Montevideo neighborhood
  for (const barrio of MONTEVIDEO_NEIGHBORHOODS) {
    if (n.includes(barrio)) {
      return { city: raw.trim(), region: "Montevideo", country: "Uruguay" };
    }
  }

  // Maldonado cities
  for (const city of MALDONADO_CITIES) {
    if (n.includes(city)) {
      const cityName = city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return { city: cityName, region: "Maldonado", country: "Uruguay" };
    }
  }

  // Department match
  for (const [key, name] of Object.entries(DEPARTMENTS)) {
    if (n.includes(key)) {
      // If it's Montevideo exactly → city = Montevideo
      if (key === "montevideo") return { city: "Montevideo", region: "Montevideo", country: "Uruguay" };
      return { city: null, region: name, country: "Uruguay" };
    }
  }

  // Default: treat as city, unknown region
  return { city: raw.trim(), region: null, country: "Uruguay" };
}
