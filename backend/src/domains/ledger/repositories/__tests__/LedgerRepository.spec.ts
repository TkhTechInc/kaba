import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LedgerRepository } from '../LedgerRepository';
import { CreateLedgerEntryInput } from '../../models/LedgerEntry';

// Mock DynamoDB client
jest.mock('@aws-sdk/lib-dynamodb');

describe('LedgerRepository', () => {
  let repository: LedgerRepository;
  let mockDocClient: jest.Mocked<DynamoDBDocumentClient>;

  beforeEach(() => {
    mockDocClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<DynamoDBDocumentClient>;

    repository = new LedgerRepository(mockDocClient, 'test-table');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create ledger entry and update balance atomically using transaction', async () => {
      const input: CreateLedgerEntryInput = {
        businessId: 'biz-123',
        type: 'sale',
        amount: 100,
        currency: 'NGN',
        description: 'Test sale',
        category: 'Revenue',
        date: '2026-03-15',
      };

      mockDocClient.send.mockResolvedValueOnce({});

      const result = await repository.create(input);

      expect(result).toMatchObject({
        businessId: 'biz-123',
        type: 'sale',
        amount: 100,
        currency: 'NGN',
        description: 'Test sale',
      });

      // Verify transaction was used (not separate Put + Update)
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      const command = mockDocClient.send.mock.calls[0][0];
      expect(command).toBeInstanceOf(TransactWriteCommand);

      // Verify transaction contains both items
      const transactCommand = command as TransactWriteCommand;
      expect(transactCommand.input.TransactItems).toHaveLength(2);

      // Verify ledger entry Put
      expect(transactCommand.input.TransactItems![0].Put).toBeDefined();
      expect(transactCommand.input.TransactItems![0].Put!.Item).toMatchObject({
        pk: 'biz-123',
        type: 'sale',
        amount: 100,
        currency: 'NGN',
      });

      // Verify balance Update
      expect(transactCommand.input.TransactItems![1].Update).toBeDefined();
      expect(transactCommand.input.TransactItems![1].Update!.Key).toEqual({
        pk: 'biz-123',
        sk: 'BALANCE',
      });
      expect(transactCommand.input.TransactItems![1].Update!.ExpressionAttributeValues).toEqual({
        ':delta': 100, // Positive for sale
        ':currency': 'NGN',
      });
    });

    it('should use negative delta for expense entries', async () => {
      const input: CreateLedgerEntryInput = {
        businessId: 'biz-123',
        type: 'expense',
        amount: 50,
        currency: 'NGN',
        description: 'Test expense',
        category: 'Operating',
        date: '2026-03-15',
      };

      mockDocClient.send.mockResolvedValueOnce({});

      await repository.create(input);

      const command = mockDocClient.send.mock.calls[0][0] as TransactWriteCommand;
      expect(command.input.TransactItems![1].Update!.ExpressionAttributeValues).toEqual({
        ':delta': -50, // Negative for expense
        ':currency': 'NGN',
      });
    });

    it('should throw DatabaseError if transaction fails', async () => {
      const input: CreateLedgerEntryInput = {
        businessId: 'biz-123',
        type: 'sale',
        amount: 100,
        currency: 'NGN',
        description: 'Test sale',
        category: 'Revenue',
        date: '2026-03-15',
      };

      mockDocClient.send.mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(repository.create(input)).rejects.toThrow('Create ledger entry failed');
    });

    it('should prevent duplicate entries with ConditionExpression', async () => {
      const input: CreateLedgerEntryInput = {
        businessId: 'biz-123',
        type: 'sale',
        amount: 100,
        currency: 'NGN',
        description: 'Test sale',
        category: 'Revenue',
        date: '2026-03-15',
      };

      mockDocClient.send.mockResolvedValueOnce({});

      await repository.create(input);

      const command = mockDocClient.send.mock.calls[0][0] as TransactWriteCommand;
      expect(command.input.TransactItems![0].Put!.ConditionExpression).toBe('attribute_not_exists(sk)');
    });
  });

  describe('softDelete', () => {
    it('should soft delete entry and reverse balance atomically using transaction', async () => {
      // Mock getById to return existing entry
      mockDocClient.send
        .mockResolvedValueOnce({
          Item: {
            pk: 'biz-123',
            sk: 'LEDGER#entry-456',
            id: 'entry-456',
            businessId: 'biz-123',
            type: 'sale',
            amount: 100,
            currency: 'NGN',
            description: 'Test',
            category: 'Revenue',
            date: '2026-03-15',
            createdAt: '2026-03-15T10:00:00.000Z',
          },
        })
        // Mock transaction success
        .mockResolvedValueOnce({});

      const result = await repository.softDelete('biz-123', 'entry-456');

      expect(result).toBe(true);

      // First call is getById, second is transaction
      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
      const command = mockDocClient.send.mock.calls[1][0];
      expect(command).toBeInstanceOf(TransactWriteCommand);

      // Verify transaction contains both items
      const transactCommand = command as TransactWriteCommand;
      expect(transactCommand.input.TransactItems).toHaveLength(2);

      // Verify soft delete Update
      expect(transactCommand.input.TransactItems![0].Update).toBeDefined();
      expect(transactCommand.input.TransactItems![0].Update!.Key).toEqual({
        pk: 'biz-123',
        sk: 'LEDGER#entry-456',
      });
      expect(transactCommand.input.TransactItems![0].Update!.UpdateExpression).toContain('deletedAt');
      expect(transactCommand.input.TransactItems![0].Update!.ConditionExpression).toContain('attribute_not_exists(deletedAt)');

      // Verify balance reversal (sale of 100 reversed to -100)
      expect(transactCommand.input.TransactItems![1].Update!.Key).toEqual({
        pk: 'biz-123',
        sk: 'BALANCE',
      });
      expect(transactCommand.input.TransactItems![1].Update!.ExpressionAttributeValues).toEqual({
        ':delta': -100, // Reverse of sale
      });
    });

    it('should return false if entry not found', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Item: undefined });

      const result = await repository.softDelete('biz-123', 'non-existent');

      expect(result).toBe(false);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1); // Only getById called
    });

    it('should return false if entry already deleted', async () => {
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          pk: 'biz-123',
          sk: 'LEDGER#entry-456',
          id: 'entry-456',
          businessId: 'biz-123',
          type: 'sale',
          amount: 100,
          currency: 'NGN',
          deletedAt: '2026-03-14T10:00:00.000Z', // Already deleted
        },
      });

      const result = await repository.softDelete('biz-123', 'entry-456');

      expect(result).toBe(false);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1); // Only getById called
    });

    it('should handle race condition gracefully', async () => {
      mockDocClient.send
        .mockResolvedValueOnce({
          Item: {
            pk: 'biz-123',
            sk: 'LEDGER#entry-456',
            id: 'entry-456',
            businessId: 'biz-123',
            type: 'sale',
            amount: 100,
            currency: 'NGN',
          },
        })
        .mockRejectedValueOnce({
          name: 'TransactionCanceledException',
          message: 'Condition check failed',
        });

      const result = await repository.softDelete('biz-123', 'entry-456');

      expect(result).toBe(false); // Another request won the race
    });

    it('should throw DatabaseError for non-condition errors', async () => {
      mockDocClient.send
        .mockResolvedValueOnce({
          Item: {
            pk: 'biz-123',
            sk: 'LEDGER#entry-456',
            id: 'entry-456',
            businessId: 'biz-123',
            type: 'sale',
            amount: 100,
            currency: 'NGN',
          },
        })
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(repository.softDelete('biz-123', 'entry-456')).rejects.toThrow('Soft-delete ledger entry failed');
    });
  });

  describe('getRunningBalance', () => {
    it('should return balance and currency', async () => {
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          pk: 'biz-123',
          sk: 'BALANCE',
          balance: 500,
          currency: 'NGN',
        },
      });

      const result = await repository.getRunningBalance('biz-123');

      expect(result).toEqual({
        balance: 500,
        currency: 'NGN',
      });

      const command = mockDocClient.send.mock.calls[0][0] as GetCommand;
      expect(command.input.Key).toEqual({
        pk: 'biz-123',
        sk: 'BALANCE',
      });
    });

    it('should return null if balance counter not initialized', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Item: undefined });

      const result = await repository.getRunningBalance('biz-123');

      expect(result).toBeNull();
    });
  });
});
