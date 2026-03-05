export type LoanOfferStatus = 'offered' | 'accepted' | 'rejected';

export interface LoanOffer {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  /** Predicted date when stock will reach zero based on current sales velocity */
  predictedStockoutDate: string;
  /** Daily sales velocity used for the prediction */
  avgDailySales: number;
  /** Current stock at time of offer */
  currentStock: number;
  /** Suggested loan amount (unitPrice × reorderQuantity) */
  suggestedLoanAmount: number;
  /** Suggested reorder quantity to cover 30 days of sales */
  suggestedReorderQuantity: number;
  currency: string;
  status: LoanOfferStatus;
  createdAt: string;
  respondedAt?: string;
}
