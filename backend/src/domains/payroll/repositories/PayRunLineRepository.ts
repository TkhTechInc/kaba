import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { PayRunLine, DeductionBreakdown, PaymentStatus } from '../models/PayRunLine';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const LINE_SK_PREFIX = 'LINE#'; // LINE#<payRunId>#<employeeId> — distinct from PAYRUN# so listByBusiness returns only PayRun items

function lineSk(payRunId: string, employeeId: string): string {
  return `${LINE_SK_PREFIX}${payRunId}#${employeeId}`;
}

export class PayRunLineRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(line: Omit<PayRunLine, 'id' | 'createdAt'>): Promise<PayRunLine> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const full: PayRunLine = {
      ...line,
      id,
      createdAt: now,
      paymentStatus: 'pending',
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(full),
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return full;
    } catch (e) {
      throw new DatabaseError('Create pay run line failed', e);
    }
  }

  async listByPayRun(businessId: string, payRunId: string): Promise<PayRunLine[]> {
    try {
      const items: PayRunLine[] = [];
      let lastKey: Record<string, unknown> | undefined;
      const skPrefix = `${LINE_SK_PREFIX}${payRunId}#`;

      do {
        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: { ':pk': businessId, ':skPrefix': skPrefix },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          }),
        );
        items.push(...(result.Items ?? []).map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);

      return items.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
    } catch (e) {
      throw new DatabaseError('List pay run lines failed', e);
    }
  }

  buildDynamoItem(line: PayRunLine): Record<string, unknown> {
    return this.mapToDynamoDB(line);
  }

  async updatePaymentStatus(
    businessId: string,
    payRunId: string,
    employeeId: string,
    status: PaymentStatus,
  ): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: lineSk(payRunId, employeeId) },
          UpdateExpression: 'SET paymentStatus = :status',
          ExpressionAttributeValues: { ':status': status },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Update pay run line payment status failed', e);
    }
  }

  private mapToDynamoDB(line: PayRunLine): Record<string, unknown> {
    const item: Record<string, unknown> = {
      pk: line.businessId,
      sk: lineSk(line.payRunId, line.employeeId),
      entityType: 'PAYRUN_LINE',
      id: line.id,
      payRunId: line.payRunId,
      businessId: line.businessId,
      employeeId: line.employeeId,
      grossSalary: line.grossSalary,
      employeeContributions: line.employeeContributions,
      employerContributions: line.employerContributions,
      incomeTax: line.incomeTax,
      deductionsBreakdown: line.deductionsBreakdown,
      netPay: line.netPay,
      payslipUrl: line.payslipUrl,
      createdAt: line.createdAt,
    };
    if (line.paymentStatus != null) item.paymentStatus = line.paymentStatus;
    return item;
  }

  private mapFromDynamoDB(item: Record<string, unknown>): PayRunLine {
    const breakdown = item.deductionsBreakdown;
    const paymentStatus = item.paymentStatus as PaymentStatus | undefined;
    return {
      id: String(item.id ?? ''),
      payRunId: String(item.payRunId ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      employeeId: String(item.employeeId ?? ''),
      grossSalary: Number(item.grossSalary ?? 0),
      employeeContributions: Number(item.employeeContributions ?? 0),
      employerContributions: Number(item.employerContributions ?? 0),
      incomeTax: Number(item.incomeTax ?? 0),
      deductionsBreakdown: Array.isArray(breakdown)
        ? (breakdown as DeductionBreakdown[])
        : [],
      netPay: Number(item.netPay ?? 0),
      paymentStatus: paymentStatus ?? undefined,
      payslipUrl: item.payslipUrl != null ? String(item.payslipUrl) : undefined,
      createdAt: String(item.createdAt ?? ''),
    };
  }
}
