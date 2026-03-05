import { Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ProductRepository } from '../repositories/ProductRepository';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { LoanOffer, LoanOfferStatus } from '../models/LoanOffer';
import { NotFoundError, ValidationError, DatabaseError } from '@/shared/errors/DomainError';

const LOAN_SK_PREFIX = 'LOAN#';

export interface StockoutForecast {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number | null;
  predictedStockoutDate: string | null;
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class RestockLoanService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Predict when stock will run out based on 30-day average daily sales velocity.
   */
  async predictStockout(businessId: string, productId: string): Promise<StockoutForecast> {
    const product = await this.productRepository.getById(businessId, productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const entries = await this.ledgerRepository.listByBusinessAndDateRange(
      businessId,
      thirtyDaysAgo,
      today
    );

    // Sum all quantities sold for this product in the last 30 days
    const totalSold = entries
      .filter((e) => e.productId === productId && e.type === 'sale' && !e.deletedAt)
      .reduce((sum, e) => sum + (e.quantitySold ?? 0), 0);

    const avgDailySales = Math.round((totalSold / 30) * 100) / 100;

    let daysUntilStockout: number | null = null;
    let predictedStockoutDate: string | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (avgDailySales > 0) {
      daysUntilStockout = Math.floor(product.quantityInStock / avgDailySales);
      const stockoutDate = new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000);
      predictedStockoutDate = stockoutDate.toISOString().slice(0, 10);

      // Confidence based on data richness
      const uniqueDays = new Set(
        entries
          .filter((e) => e.productId === productId)
          .map((e) => e.date)
      ).size;

      if (uniqueDays >= 20) confidence = 'high';
      else if (uniqueDays >= 7) confidence = 'medium';
      else confidence = 'low';
    }

    return {
      productId,
      productName: product.name,
      currentStock: product.quantityInStock,
      avgDailySales,
      daysUntilStockout,
      predictedStockoutDate,
      confidence,
    };
  }

  /**
   * Generate a Sika Restock Credit offer for a product.
   * The offer is stored as a LOAN# item in the Inventory DynamoDB table.
   */
  async offerRestockLoan(businessId: string, productId: string): Promise<LoanOffer> {
    const forecast = await this.predictStockout(businessId, productId);
    const product = await this.productRepository.getById(businessId, productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    if (forecast.avgDailySales <= 0) {
      throw new ValidationError(
        'Insufficient sales history to offer a restock loan for this product'
      );
    }

    // Suggest enough stock to cover 30 days of sales
    const suggestedReorderQuantity = Math.ceil(forecast.avgDailySales * 30);
    const suggestedLoanAmount = Math.round(suggestedReorderQuantity * product.unitPrice * 100) / 100;

    const now = new Date().toISOString();
    const offer: LoanOffer = {
      id: uuidv4(),
      businessId,
      productId,
      productName: product.name,
      predictedStockoutDate: forecast.predictedStockoutDate ?? 'unknown',
      avgDailySales: forecast.avgDailySales,
      currentStock: product.quantityInStock,
      suggestedLoanAmount,
      suggestedReorderQuantity,
      currency: product.currency,
      status: 'offered',
      createdAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: businessId,
            sk: `${LOAN_SK_PREFIX}${offer.id}`,
            entityType: 'LOAN_OFFER',
            ...offer,
          },
          ConditionExpression: 'attribute_not_exists(sk)',
        })
      );
    } catch (e) {
      throw new DatabaseError('Create loan offer failed', e);
    }

    return offer;
  }

  async getOffer(businessId: string, offerId: string): Promise<LoanOffer | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${LOAN_SK_PREFIX}${offerId}` },
        })
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get loan offer failed', e);
    }
  }

  async respondToOffer(
    businessId: string,
    offerId: string,
    decision: 'accepted' | 'rejected'
  ): Promise<LoanOffer> {
    const existing = await this.getOffer(businessId, offerId);
    if (!existing) {
      throw new NotFoundError('LoanOffer', offerId);
    }
    if (existing.status !== 'offered') {
      throw new ValidationError(`Loan offer has already been ${existing.status}`);
    }

    const now = new Date().toISOString();
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${LOAN_SK_PREFIX}${offerId}` },
          UpdateExpression: 'SET #status = :status, respondedAt = :at',
          ConditionExpression: '#status = :offered',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': decision,
            ':at': now,
            ':offered': 'offered',
          },
        })
      );
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
        throw new ValidationError('Offer status changed concurrently');
      }
      throw new DatabaseError('Update loan offer failed', e);
    }

    return { ...existing, status: decision, respondedAt: now };
  }

  async listOffersForProduct(businessId: string, productId: string): Promise<LoanOffer[]> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          FilterExpression: 'productId = :pid',
          ExpressionAttributeValues: {
            ':pk': businessId,
            ':prefix': LOAN_SK_PREFIX,
            ':pid': productId,
          },
          ScanIndexForward: false,
        })
      );
      return (result.Items ?? []).map((item) => this.mapFromDynamoDB(item));
    } catch (e) {
      throw new DatabaseError('List loan offers failed', e);
    }
  }

  private mapFromDynamoDB(item: Record<string, unknown>): LoanOffer {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? ''),
      productId: String(item.productId ?? ''),
      productName: String(item.productName ?? ''),
      predictedStockoutDate: String(item.predictedStockoutDate ?? ''),
      avgDailySales: Number(item.avgDailySales ?? 0),
      currentStock: Number(item.currentStock ?? 0),
      suggestedLoanAmount: Number(item.suggestedLoanAmount ?? 0),
      suggestedReorderQuantity: Number(item.suggestedReorderQuantity ?? 0),
      currency: String(item.currency ?? ''),
      status: (item.status as LoanOfferStatus) ?? 'offered',
      createdAt: String(item.createdAt ?? ''),
      respondedAt: item.respondedAt != null ? String(item.respondedAt) : undefined,
    };
  }
}
