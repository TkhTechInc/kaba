/**
 * MECeF (Module de Contrôle de Facturation Électronique) provider interface.
 * Applies ONLY to Benin (BJ) where the DGI mandates real-time invoice validation
 * via the e-mecef.impots.bj API before an invoice is legally recognized.
 *
 * API spec: e-MCF API v1.0 (DGI Bénin, 15/01/2021)
 *
 * Flow:
 *  1. registerInvoice → POST /api/invoice → DGI returns uid + computed totals (2-min window)
 *  2. confirmInvoice  → PUT /api/invoice/{uid}/confirm → DGI returns QR + codeMECeFDGI
 */

/**
 * Tax group codes as defined by the DGI e-MCF API.
 * - A: 0% (exempt / exonéré)
 * - B: 18% TVA (standard taxed goods/services)
 * - C: 18% (special cases)
 * - D: 18% (special cases)
 * - E: 0% (special exempt)
 * - F: 0% (special exempt)
 */
export type MECeFTaxGroup = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * AIB (Acompte sur Impôt sur le revenu des Bénéfices) rate group.
 * - A: 1% AIB
 * - B: 5% AIB
 */
export type MECeFAibGroup = 'A' | 'B';

/**
 * Payment type as defined by the DGI e-MCF API.
 */
export type MECeFPaymentType =
  | 'ESPECES'
  | 'VIREMENT'
  | 'CARTEBANCAIRE'
  | 'MOBILEMONEY'
  | 'CHEQUES'
  | 'CREDIT'
  | 'AUTRE';

export interface MECeFInvoiceItem {
  /** Optional article code */
  code?: string;
  /** Item name */
  name: string;
  /** Unit price TTC (integer, in XOF) — DGI computes HT/TVA from this + taxGroup */
  price: number;
  /** Quantity (decimal) */
  quantity: number;
  /** Tax group: A=0%, B=18%, C=18%, D=18%, E=0%, F=0% */
  taxGroup: MECeFTaxGroup;
  /** Optional: total specific tax for entire quantity (not per unit) */
  taxSpecific?: number;
  /** Optional: original price before discount */
  originalPrice?: number;
  /** Optional: description of price modification (e.g. "Remise 50%") */
  priceModification?: string;
}

export interface MECeFPayment {
  /** Payment method */
  name: MECeFPaymentType;
  /** Amount paid via this method (integer, in XOF) */
  amount: number;
}

export interface MECeFInvoicePayload {
  /** IFU du vendeur — 13-char Benin tax ID of the seller */
  ifu: string;
  /**
   * Invoice type:
   * - FV: Facture de Vente (sale)
   * - EV: Facture de Vente à l'exportation (export sale)
   * - FA: Facture d'Avoir (credit note — requires reference)
   * - EA: Facture d'Avoir à l'exportation (export credit note)
   */
  type_facture: 'FV' | 'FA' | 'EV' | 'EA';
  /** Line items — at least one required */
  items: MECeFInvoiceItem[];
  /** Operator (cashier/system) — name is required */
  operator: { id?: string; name: string };
  /** Optional client info — IFU validated by DGI if provided */
  client?: {
    ifu?: string;
    name?: string;
    contact?: string;
    address?: string;
  };
  /** Payment methods — defaults to ESPECES if omitted */
  payment?: MECeFPayment[];
  /**
   * AIB tax group — include when customer is liable for AIB:
   * A = 1%, B = 5%
   */
  aib?: MECeFAibGroup;
  /**
   * Required for FA/EA: 24-char codeMECeFDGI of the original invoice
   * (the `codeMECeFDGI` field from the original invoice's SecurityElementsDto)
   */
  reference?: string;
}

export interface MECeFRegistrationResult {
  /** Temporary uid returned by DGI — must be confirmed within 120 seconds */
  token: string;
  /** ISO timestamp when this token expires */
  expires_at: string;
  /** Always 'pending' at this stage */
  status: 'pending';
  /** DGI-computed totals from the invoice POST (for SFE verification) */
  totals?: {
    /** Tax rate for group A (%) */
    ta: number;
    /** Tax rate for group B (%) */
    tb: number;
    /** Total amount for group A (HT) */
    taa: number;
    /** Total amount for group B (HT) */
    tab: number;
    /** HT amount for group B */
    hab: number;
    /** TVA amount for group B */
    vab: number;
    /** AIB amount */
    aib: number;
    /** Specific tax total */
    ts: number;
    /** Grand total (TTC) */
    total: number;
  };
}

export interface MECeFConfirmResult {
  /** QR code string from DGI (format: F;{nim};{codeMECeFDGI};{ifu};{datetime}) */
  qr_code: string;
  /** Code MECeF/DGI — the official 29-char fiscal certification code (e.g. "X537-E4DB-...") */
  codeMECeFDGI: string;
  /** NIM of the e-MCF device that issued the certification */
  nim: string;
  /** Invoice counters (e.g. "64/64 FV") */
  counters: string;
  /** Date and time of certification from DGI (format: "DD/MM/YYYY HH:mm:ss") */
  dateTime: string;
}

export interface IMECeFProvider {
  /**
   * Step 1: Register invoice with the DGI pre-clearance endpoint.
   * Returns a uid valid for 120 seconds. DGI computes and returns totals.
   */
  registerInvoice(payload: MECeFInvoicePayload): Promise<MECeFRegistrationResult>;

  /**
   * Step 2: Confirm or cancel the pre-registered invoice.
   * Must be called within 120 seconds of registerInvoice.
   * Returns QR code + codeMECeFDGI on confirmation, null on cancel.
   */
  confirmInvoice(
    token: string,
    decision: 'confirm' | 'cancel'
  ): Promise<MECeFConfirmResult | null>;

  /** Returns ISO-3166-1 alpha-2 country codes where MECeF applies. Currently ['BJ']. */
  getSupportedCountries(): string[];
}
