import { api } from "@/lib/api-client";

export interface VATSummary {
  totalVAT: number;
  totalSales: number;
  totalPurchases: number;
  currency: string;
  period: { start: string; end: string };
  breakdown?: Array<{ rate: number; amount: number; base: number }>;
}

export function createTaxApi(token: string | null) {
  const params = (businessId: string, fromDate: string, toDate: string, countryCode?: string) => {
    const q = new URLSearchParams({
      businessId,
      fromDate,
      toDate,
      ...(countryCode && { countryCode }),
    });
    return `?${q.toString()}`;
  };

  return {
    getVAT: (businessId: string, fromDate: string, toDate: string, countryCode = "NG") =>
      api.get<VATSummary>(
        `/api/v1/tax/vat${params(businessId, fromDate, toDate, countryCode)}`,
        { token: token ?? undefined }
      ),

    getSupportedCountries: () =>
      api.get<{ countries: string[] }>("/api/v1/tax/countries", {
        token: token ?? undefined,
      }),
  };
}
