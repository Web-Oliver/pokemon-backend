# Frontend API Integration Design Document

## Overview

This document provides a comprehensive guide for frontend developers to implement proper API calls and handle responses from the newly updated Pokemon Collection Backend system. The backend has been enhanced with standardized response formats, MongoDB object serialization fixes, and improved error handling.

## Code Reuse Analysis

### Existing Backend Architecture
- **ResponseTransformer Middleware**: Automatically converts MongoDB objects (Decimal128, Binary) to JavaScript primitives
- **BaseController Pattern**: Standardized CRUD operations with consistent response formats
- **Enhanced Search System**: Unified search across all collection types
- **Dependency Injection Container**: Centralized service management
- **Plugin Architecture**: Extensible functionality with caching, validation, and performance tracking

### Current Response Format
All API endpoints now return standardized responses:
```typescript
interface APIResponse<T> {
  success: boolean;
  status: 'success' | 'error' | 'partial';
  data: T;
  count?: number;
  meta: {
    timestamp: string;
    version: string;
    duration: string;
    cached?: boolean;
  };
}
```

## Architecture

### API Base Configuration
```typescript
const API_BASE_URL = 'http://localhost:3000/api';

// Standard headers for all requests
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

### Response Types
```typescript
// Base API Response
interface APIResponse<T = any> {
  success: boolean;
  status: 'success' | 'error' | 'partial';
  data: T;
  count?: number;
  meta: {
    timestamp: string;
    version: string;
    duration: string;
    cached?: boolean;
  };
}

// Error Response
interface APIError extends APIResponse<null> {
  message: string;
  details?: any;
}

// Collection Response
interface CollectionResponse<T> extends APIResponse<T[]> {
  count: number;
}

// Search Response
interface SearchResponse<T> extends APIResponse<T[]> {
  search: {
    term: string;
    total: number;
    returned: number;
  };
}
```

## Components and Interfaces

### 1. API Client Base
```typescript
class APIClient {
  private baseURL: string;
  
  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new APIError(data.message || 'Request failed', data);
    }
    
    return data;
  }
  
  async get<T>(endpoint: string, params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }
  
  async post<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  
  async put<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }
  
  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
```

### 2. Collection API Services
```typescript
// PSA Graded Cards Service
class PSAGradedCardsService {
  constructor(private apiClient: APIClient) {}
  
  async getAll(params?: {
    page?: number;
    limit?: number;
    sold?: boolean;
    grade?: number;
  }): Promise<CollectionResponse<PSAGradedCard>> {
    return this.apiClient.get<PSAGradedCard[]>('/psa-graded-cards', params);
  }
  
  async getById(id: string): Promise<APIResponse<PSAGradedCard>> {
    return this.apiClient.get<PSAGradedCard>(`/psa-graded-cards/${id}`);
  }
  
  async create(data: CreatePSAGradedCard): Promise<APIResponse<PSAGradedCard>> {
    return this.apiClient.post<PSAGradedCard>('/psa-graded-cards', data);
  }
  
  async update(id: string, data: Partial<PSAGradedCard>): Promise<APIResponse<PSAGradedCard>> {
    return this.apiClient.put<PSAGradedCard>(`/psa-graded-cards/${id}`, data);
  }
  
  async delete(id: string): Promise<APIResponse<void>> {
    return this.apiClient.delete<void>(`/psa-graded-cards/${id}`);
  }
}

// Raw Cards Service
class RawCardsService {
  constructor(private apiClient: APIClient) {}
  
  async getAll(params?: {
    page?: number;
    limit?: number;
    sold?: boolean;
    condition?: string;
  }): Promise<CollectionResponse<RawCard>> {
    return this.apiClient.get<RawCard[]>('/raw-cards', params);
  }
  
  // ... similar methods for CRUD operations
}

// Sealed Products Service
class SealedProductsService {
  constructor(private apiClient: APIClient) {}
  
  async getAll(params?: {
    page?: number;
    limit?: number;
    category?: string;
    setName?: string;
  }): Promise<CollectionResponse<SealedProduct>> {
    return this.apiClient.get<SealedProduct[]>('/sealed-products', params);
  }
  
  // ... similar methods for CRUD operations
}

// Auctions Service
class AuctionsService {
  constructor(private apiClient: APIClient) {}
  
  async getAll(params?: {
    status?: 'draft' | 'active' | 'sold' | 'expired';
  }): Promise<CollectionResponse<Auction>> {
    return this.apiClient.get<Auction[]>('/auctions', params);
  }
  
  async addItemToAuction(auctionId: string, item: AuctionItem): Promise<APIResponse<Auction>> {
    return this.apiClient.post<Auction>(`/auctions/${auctionId}/items`, item);
  }
  
  async markItemAsSold(auctionId: string, itemId: string): Promise<APIResponse<Auction>> {
    return this.apiClient.patch<Auction>(`/auctions/${auctionId}/items/sold`, { itemId });
  }
}
```

### 3. Search Service
```typescript
class SearchService {
  constructor(private apiClient: APIClient) {}
  
  async unifiedSearch(params: {
    q: string;
    categories?: string[];
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<SearchResponse<SearchResult>> {
    return this.apiClient.get<SearchResult[]>('/search', params);
  }
  
  async searchCards(params: {
    q?: string;
    setName?: string;
    pokemonNumber?: string;
    year?: number;
  }): Promise<SearchResponse<Card>> {
    return this.apiClient.get<Card[]>('/cards/search', params);
  }
}
```

### 4. Frontend Integration Hooks (React)
```typescript
// Custom hooks for API integration
import { useState, useEffect } from 'react';

export function useAPICall<T>(
  apiCall: () => Promise<APIResponse<T>>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await apiCall();
        if (isMounted) {
          setData(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => { isMounted = false; };
  }, dependencies);
  
  return { data, loading, error };
}

// Hook for collections
export function useCollection<T>(
  service: any,
  params?: Record<string, any>
) {
  return useAPICall<T[]>(
    () => service.getAll(params),
    [JSON.stringify(params)]
  );
}

// Usage example:
const { data: auctions, loading, error } = useCollection(
  auctionsService,
  { status: 'active' }
);

// Fix for the current issue - accessing data property
useEffect(() => {
  if (auctions) {
    // The data is already extracted from response.data by the hook
    const filteredAuctions = auctions.filter(auction => auction.status === 'active');
    // ... rest of your logic
  }
}, [auctions]);
```

## Data Models

### Core Entity Types
```typescript
interface PSAGradedCard {
  _id: string;
  cardId: Card;
  grade: number;
  images: string[];
  myPrice: number; // Automatically converted from MongoDB Decimal128
  priceHistory: PriceHistory[];
  dateAdded: string;
  sold: boolean;
  saleDetails?: SaleDetails;
}

interface RawCard {
  _id: string;
  cardId: Card;
  condition: string;
  images: string[];
  myPrice: number;
  priceHistory: PriceHistory[];
  dateAdded: string;
  sold: boolean;
  saleDetails?: SaleDetails;
}

interface SealedProduct {
  _id: string;
  productId: CardMarketReferenceProduct;
  category: string;
  setName: string;
  name: string;
  availability: string;
  cardMarketPrice: number;
  myPrice: number;
  priceHistory: PriceHistory[];
  images: string[];
  dateAdded: string;
  sold: boolean;
  saleDetails?: SaleDetails;
}

interface Auction {
  _id: string;
  topText: string;
  bottomText: string;
  auctionDate: string;
  status: 'draft' | 'active' | 'sold' | 'expired';
  generatedFacebookPost: string;
  isActive: boolean;
  items: AuctionItem[];
  totalValue: number;
  soldValue: number;
}

interface Card {
  _id: string;
  setId: Set;
  pokemonNumber: string;
  cardName: string;
  baseName: string;
  variety: string;
  psaGrades: Record<string, number>;
  psaTotalGradedForCard: number;
}

interface Set {
  _id: string;
  setName: string;
  year: number;
  setUrl: string;
  totalCardsInSet: number;
  totalPsaPopulation: number;
}

interface PriceHistory {
  price: number;
  date: string;
  source: string;
}

interface SaleDetails {
  payment: string;
  actualSoldPrice: number;
  delivery: string;
  source: string;
  buyerFullName: string;
  buyerAddress: {
    streetName: string;
    city: string;
    postalCode: string;
  };
  tracking: string;
}
```

### Search Result Types
```typescript
interface SearchResult {
  _id: string;
  type: 'card' | 'product' | 'set';
  name: string;
  setName?: string;
  category?: string;
  score: number;
  highlights?: string[];
}
```

## Error Handling

### Error Types
```typescript
class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Usage in components
const handleAPIError = (error: unknown) => {
  if (error instanceof APIError) {
    // Handle API-specific errors
    console.error(`API Error ${error.statusCode}: ${error.message}`);
    setErrorMessage(error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
    setErrorMessage('An unexpected error occurred');
  }
};
```

### Response Validation
```typescript
function validateAPIResponse<T>(response: any): APIResponse<T> {
  if (!response || typeof response !== 'object') {
    throw new APIError('Invalid response format');
  }
  
  if (!response.success || !response.data) {
    throw new APIError(response.message || 'Request failed', response.statusCode);
  }
  
  return response as APIResponse<T>;
}
```

## Testing Strategy

### API Client Testing
```typescript
// Mock API responses for testing
const mockAPIResponse = <T>(data: T): APIResponse<T> => ({
  success: true,
  status: 'success',
  data,
  meta: {
    timestamp: new Date().toISOString(),
    version: '1.0',
    duration: '1ms'
  }
});

// Test example
describe('PSAGradedCardsService', () => {
  it('should fetch PSA graded cards', async () => {
    const mockCards = [{ _id: '1', grade: 10 }];
    const mockResponse = mockAPIResponse(mockCards);
    
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const service = new PSAGradedCardsService(new APIClient());
    const result = await service.getAll();
    
    expect(result.data).toEqual(mockCards);
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing
```typescript
// Test the actual API endpoints
describe('API Integration', () => {
  const apiClient = new APIClient('http://localhost:3000/api');
  
  it('should handle response format correctly', async () => {
    const response = await apiClient.get<any[]>('/auctions');
    
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('meta');
    expect(Array.isArray(response.data)).toBe(true);
  });
});
```

## Migration Guide

### Updating Existing Frontend Code

#### Before (Old Format):
```typescript
// Old code expecting direct array
const fetchAuctions = async () => {
  const auctions = await fetch('/api/auctions').then(r => r.json());
  return auctions.filter(auction => auction.status === 'active');
};
```

#### After (New Format):
```typescript
// New code handling standardized response
const fetchAuctions = async () => {
  const response = await fetch('/api/auctions').then(r => r.json());
  if (!response.success) {
    throw new Error(response.message || 'Failed to fetch auctions');
  }
  return response.data.filter(auction => auction.status === 'active');
};
```

### Key Changes Required:
1. **Response Structure**: Access data via `response.data` instead of using response directly
2. **Error Handling**: Check `response.success` and handle `response.message` for errors
3. **Price Fields**: No longer need to handle MongoDB Decimal128 objects - all prices are numbers
4. **Metadata**: Utilize `response.meta` for caching, timing, and debugging information

## Implementation Checklist

- [ ] Update API client to handle new response format
- [ ] Create typed interfaces for all data models
- [ ] Implement error handling for API failures
- [ ] Update existing components to access `response.data`
- [ ] Add loading and error states to UI components
- [ ] Implement caching strategy using `response.meta.cached`
- [ ] Add retry logic for failed requests
- [ ] Test all API endpoints with new format
- [ ] Update tests to mock new response structure
- [ ] Document breaking changes for team

---

Does the design look good? If so, we can move on to the implementation plan.