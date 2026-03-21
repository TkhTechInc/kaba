import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Employee, CreateEmployeeInput } from '../models/Employee';
import { DatabaseError } from '@/shared/errors/DomainError';
import { v4 as uuidv4 } from 'uuid';

const SK_PREFIX = 'EMPLOYEE#';

export class EmployeeRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const employee: Employee = {
      id,
      businessId: input.businessId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      momoPhone: input.momoPhone,
      grossSalary: input.grossSalary,
      currency: input.currency,
      countryCode: input.countryCode,
      cnssNumber: input.cnssNumber,
      employmentStartDate: input.employmentStartDate,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(employee),
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return employee;
    } catch (e) {
      throw new DatabaseError('Create employee failed', e);
    }
  }

  async findById(businessId: string, id: string): Promise<Employee | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item as Record<string, unknown>);
    } catch (e) {
      throw new DatabaseError('Get employee failed', e);
    }
  }

  async listByBusiness(businessId: string, status?: 'active' | 'inactive', limit = 100): Promise<Employee[]> {
    try {
      const items: Employee[] = [];
      let lastKey: Record<string, unknown> | undefined;

      do {
        const exprValues: Record<string, unknown> = { ':pk': businessId, ':skPrefix': SK_PREFIX };
        if (status) exprValues[':status'] = status;

        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
            ExpressionAttributeValues: exprValues,
            ...(status && {
              FilterExpression: '#s = :status',
              ExpressionAttributeNames: { '#s': 'status' },
            }),
            Limit: limit,
            ...(lastKey && { ExclusiveStartKey: lastKey }),
          }),
        );
        const rawItems = result.Items ?? [];
        items.push(...rawItems.map((i) => this.mapFromDynamoDB(i as Record<string, unknown>)));
        lastKey = result.LastEvaluatedKey;
      } while (lastKey && items.length < limit);

      return items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    } catch (e) {
      throw new DatabaseError('List employees failed', e);
    }
  }

  async update(employee: Employee): Promise<Employee> {
    const updated = { ...employee, updatedAt: new Date().toISOString() };
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(updated),
        }),
      );
      return updated;
    } catch (e) {
      throw new DatabaseError('Update employee failed', e);
    }
  }

  async delete(businessId: string, id: string): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: `${SK_PREFIX}${id}` },
        }),
      );
    } catch (e) {
      throw new DatabaseError('Delete employee failed', e);
    }
  }

  private mapToDynamoDB(employee: Employee): Record<string, unknown> {
    const item: Record<string, unknown> = {
      pk: employee.businessId,
      sk: `${SK_PREFIX}${employee.id}`,
      entityType: 'EMPLOYEE',
      id: employee.id,
      businessId: employee.businessId,
      name: employee.name,
      grossSalary: employee.grossSalary,
      currency: employee.currency,
      countryCode: employee.countryCode,
      employmentStartDate: employee.employmentStartDate,
      status: employee.status,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
    if (employee.email != null) item.email = employee.email;
    if (employee.phone != null) item.phone = employee.phone;
    if (employee.momoPhone != null) item.momoPhone = employee.momoPhone;
    if (employee.cnssNumber != null) item.cnssNumber = employee.cnssNumber;
    return item;
  }

  private mapFromDynamoDB(item: Record<string, unknown>): Employee {
    return {
      id: String(item.id ?? ''),
      businessId: String(item.businessId ?? item.pk ?? ''),
      name: String(item.name ?? ''),
      email: item.email != null ? String(item.email) : undefined,
      phone: item.phone != null ? String(item.phone) : undefined,
      momoPhone: item.momoPhone != null ? String(item.momoPhone) : undefined,
      grossSalary: Number(item.grossSalary ?? 0),
      currency: String(item.currency ?? 'XOF'),
      countryCode: String(item.countryCode ?? 'BJ'),
      cnssNumber: item.cnssNumber != null ? String(item.cnssNumber) : undefined,
      employmentStartDate: String(item.employmentStartDate ?? ''),
      status: (item.status as 'active' | 'inactive') ?? 'active',
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    };
  }
}
