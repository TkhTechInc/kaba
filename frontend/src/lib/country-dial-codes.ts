/**
 * ISO 3166-1 alpha-2 country code -> international dial code for West Africa and common countries.
 * Used for phone placeholders in forms.
 */
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  NG: "+234", // Nigeria
  BJ: "+229", // Benin
  GH: "+233", // Ghana
  TG: "+228", // Togo
  CI: "+225", // Côte d'Ivoire
  SN: "+221", // Senegal
  ML: "+223", // Mali
  NE: "+227", // Niger
  BF: "+226", // Burkina Faso
  GM: "+220", // Gambia
  GN: "+224", // Guinea
  GW: "+245", // Guinea-Bissau
  LR: "+231", // Liberia
  SL: "+232", // Sierra Leone
  CM: "+237", // Cameroon
  GA: "+241", // Gabon
  CG: "+242", // Congo
  CD: "+243", // DRC
  US: "+1",
  GB: "+44",
  FR: "+33",
};

export function getPhonePlaceholder(countryCode: string | null | undefined): string {
  if (!countryCode?.trim()) return "+234...";
  const code = countryCode.toUpperCase().trim();
  const dial = COUNTRY_DIAL_CODES[code];
  return dial ? `${dial}...` : "+234...";
}
