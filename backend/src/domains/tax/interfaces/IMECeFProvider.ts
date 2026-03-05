/**
 * MECeF (Module de Contrôle de Facturation Électronique) provider interface.
 * Applies ONLY to Benin (BJ) where the DGI mandates real-time invoice validation
 * via the e-mecef.impots.bj API before an invoice is legally recognized.
 *
 * Flow:
 *  1. registerInvoice → DGI returns token + 2-minute validation window
 *  2. confirmInvoice  → within 120s, app confirms; DGI returns QR + fiscal serial
 */

export interface MECeFInvoiceItem {
  /** Item description */
  nom: string;
  /** Quantity */
  quantite: number;
  /** Unit price excluding tax (XOF) */
  prix_unitaire_ht: number;
  /** Total amount excluding tax (XOF) */
  montant_ht: number;
  /** VAT amount for this line */
  montant_tva: number;
  /** Total amount including tax (XOF) */
  montant_ttc: number;
}

export interface MECeFInvoicePayload {
  /** Numéro d'Identification du Mécanisme (merchant device/app ID) */
  nim: string;
  /** IFU du vendeur (Tax ID of the seller) */
  ifu: string;
  /** IFU du client (optional — for B2B invoices) */
  client_ifu?: string;
  /** Invoice reference/number in seller's system */
  reference?: string;
  /** Total HT (excluding tax) */
  montant_ht: number;
  /** Total TVA */
  montant_tva: number;
  /** Total TTC (including tax) */
  montant_ttc: number;
  /** Invoice type: 'FV' = Facture de Vente, 'FA' = Facture d'Avoir (credit note) */
  type_facture: 'FV' | 'FA';
  /** Line items */
  items: MECeFInvoiceItem[];
  /** Invoice date (YYYY-MM-DD) */
  date: string;
}

export interface MECeFRegistrationResult {
  /** Temporary token returned by DGI — must be confirmed within 120 seconds */
  token: string;
  /** ISO timestamp when this token expires */
  expires_at: string;
  /** Always 'pending' at this stage */
  status: 'pending';
}

export interface MECeFConfirmResult {
  /** QR code data URL or raw string from DGI */
  qr_code: string;
  /** Official fiscal invoice serial number (NIM_Facture) */
  nim_facture: string;
  /** DGI digital signature */
  signature: string;
  /** ISO timestamp of DGI certification */
  certified_at: string;
}

export interface IMECeFProvider {
  /**
   * Step 1: Register invoice with the DGI pre-clearance endpoint.
   * Returns a token valid for 120 seconds.
   */
  registerInvoice(payload: MECeFInvoicePayload): Promise<MECeFRegistrationResult>;

  /**
   * Step 2: Confirm or reject the pre-registered invoice.
   * Must be called within 120 seconds of registerInvoice.
   * Returns QR code + fiscal serial on confirmation.
   */
  confirmInvoice(
    token: string,
    decision: 'confirm' | 'reject'
  ): Promise<MECeFConfirmResult | null>;

  /** Returns ISO-3166-1 alpha-2 country codes where MECeF applies. Currently ['BJ']. */
  getSupportedCountries(): string[];
}
