import { DomainError, NotFoundError, ValidationError } from '../errors/DomainError';

describe('DomainError', () => {
  it('NotFoundError extends DomainError', () => {
    const err = new NotFoundError('LedgerEntry', 'id-123');
    expect(err.message).toContain('LedgerEntry');
    expect(err.message).toContain('id-123');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(DomainError);
  });

  it('ValidationError extends DomainError', () => {
    const err = new ValidationError('Invalid amount');
    expect(err.message).toBe('Invalid amount');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(DomainError);
  });
});
