// Supabase query optimization and error handling utilities

import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';

// Generic error handler for Supabase operations
export const handleFirebaseError = (error: any, operation: string, showToast: boolean = false) => {
  console.error(`Supabase ${operation} error:`, error);

  let message: string;

  if (error?.code === '42501') {
    message = 'Access denied. Please check your permissions.';
  } else if (error?.code === 'PGRST116') {
    message = 'Data not found';
  } else if (error?.code === '401') {
    message = 'Authentication required. Please log in again.';
  } else {
    message = `Error during ${operation}. Please try again.`;
  }

  // Only show toast if explicitly requested
  if (showToast) {
    toast.error(message);
  }

  return message;
};

// Optimized query builder with automatic pagination and caching
export class OptimizedQuery {
  private collectionName: string;
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private orderByColumn?: string;
  private orderDirection: 'asc' | 'desc' = 'asc';
  private pageSize: number = 25;
  private cache: Map<string, { data: any[], timestamp: number }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  whereField(field: string, operator: any, value: any): OptimizedQuery {
    this.filters.push({ column: field, operator: operator === '==' ? 'eq' : operator, value });
    return this;
  }

  orderByField(field: string, direction: 'asc' | 'desc' = 'asc'): OptimizedQuery {
    this.orderByColumn = field;
    this.orderDirection = direction;
    return this;
  }

  limitTo(count: number): OptimizedQuery {
    this.pageSize = count;
    return this;
  }

  // Build cache key from constraints
  private getCacheKey(): string {
    return `${this.collectionName}_${JSON.stringify({ filters: this.filters, orderBy: this.orderByColumn, dir: this.orderDirection, limit: this.pageSize })}`;
  }

  // Check if cached data is still valid
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return (Date.now() - cached.timestamp) < this.cacheTimeout;
  }

  // Execute query with caching
  async execute(): Promise<{ data: any[], error?: string }> {
    const cacheKey = this.getCacheKey();

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return { data: this.cache.get(cacheKey)!.data };
    }

    try {
      let q = supabase.from(this.collectionName).select('*');

      for (const f of this.filters) {
        q = q.filter(f.column, f.operator as any, f.value);
      }

      if (this.orderByColumn) {
        q = q.order(this.orderByColumn, { ascending: this.orderDirection === 'asc' });
      }

      q = q.limit(this.pageSize);

      const { data, error } = await q;

      if (error) {
        const errorMessage = handleFirebaseError(error, `query ${this.collectionName}`);
        return { data: [], error: errorMessage };
      }

      const rows = data ?? [];

      // Cache the results
      this.cache.set(cacheKey, {
        data: rows,
        timestamp: Date.now()
      });

      return { data: rows };

    } catch (error) {
      const errorMessage = handleFirebaseError(error, `query ${this.collectionName}`);
      return { data: [], error: errorMessage };
    }
  }

  // Set up real-time listener with error handling
  onSnapshot(
    callback: (data: any[], error?: string) => void
  ) {
    try {
      let q = supabase.from(this.collectionName).select('*');

      for (const f of this.filters) {
        q = q.filter(f.column, f.operator as any, f.value);
      }

      if (this.orderByColumn) {
        q = q.order(this.orderByColumn, { ascending: this.orderDirection === 'asc' });
      }

      q = q.limit(this.pageSize);

      const channel = supabase
        .channel(`realtime-${this.collectionName}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: this.collectionName,
          },
          (payload) => {
            this.execute().then(({ data }) => {
              const cacheKey = this.getCacheKey();
              this.cache.set(cacheKey, { data, timestamp: Date.now() });
              callback(data);
            }).catch((err) => {
              const errorMessage = handleFirebaseError(err, `real-time ${this.collectionName}`);
              callback([], errorMessage);
            });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error, `listener setup ${this.collectionName}`);
      callback([], errorMessage);
      return () => {}; // Return empty unsubscribe function
    }
  }

  // Clear cache for this collection
  clearCache(): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key =>
      key.startsWith(this.collectionName)
    );
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Factory function for creating optimized queries
export const createQuery = (collectionName: string): OptimizedQuery => {
  return new OptimizedQuery(collectionName);
};

// Retry wrapper for Supabase operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`Operation failed, retry ${i + 1}/${maxRetries}:`, error);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
      }
    }
  }

  throw lastError!;
};

// Batch operation wrapper with proper error handling
export const executeBatch = async (operations: (() => Promise<any>)[]): Promise<any[]> => {
  const results = await Promise.allSettled(operations.map(op => op()));

  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  if (failed.length > 0) {
    console.warn(`Batch operation: ${successful.length} succeeded, ${failed.length} failed`);
    failed.forEach((failure, index) => {
      console.error(`Batch operation ${index} failed:`, failure.reason);
    });
  }

  return results;
};

// Connection health checker
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    const testQuery = createQuery('systemConfig').limitTo(1);
    await testQuery.execute();
    return true;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
};
