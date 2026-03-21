/**
 * Standard cursor-based pagination request parameters.
 * Optimized for DynamoDB's ExclusiveStartKey pagination.
 */
export interface CursorPaginationRequest {
  /** Maximum number of items to return (default: 50) */
  limit?: number;
  /** Opaque cursor from previous response's nextCursor */
  cursor?: string;
}

/**
 * Standard cursor-based pagination response.
 * Use this for all list/query endpoints to provide consistent DX.
 */
export interface CursorPaginationResponse<T> {
  /** Array of items for the current page */
  items: T[];
  /** Cursor to fetch the next page (undefined if no more pages) */
  nextCursor?: string;
  /** Whether there are more items available */
  hasMore: boolean;
}
