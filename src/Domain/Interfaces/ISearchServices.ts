/**
 * Search Domain Service Interfaces
 * 
 * Defines contracts for search services with proper separation by entity type
 * Each interface handles ONE entity type, ZERO overlap
 */

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  populate?: string[];
}

export interface SearchFilters {
  [key: string]: any;
}

export interface CardFilters extends SearchFilters {
  setId?: string;
  setName?: string;
  year?: number;
  rarity?: string;
  cardNumber?: string;
}

export interface ProductFilters extends SearchFilters {
  category?: string;
  setProductId?: string;
  priceRange?: { min: number; max: number };
}

export interface SetFilters extends SearchFilters {
  year?: number;
  series?: string;
}

export interface SearchResult<T> {
  results: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ProcessedQuery {
  query: string;
  terms: string[];
  fuzzyTerms: string[];
  exactPhrase?: string;
}

// ============ CORE SEARCH SERVICE INTERFACES ============

/**
 * CARD SEARCHER - Single responsibility: Search cards only
 */
export interface ICardSearcher {
  search(query: string, filters?: CardFilters, options?: SearchOptions): Promise<SearchResult<any>>;
  searchBySet(setId: string, query?: string, options?: SearchOptions): Promise<SearchResult<any>>;
  searchByNumber(cardNumber: string, options?: SearchOptions): Promise<SearchResult<any>>;
}

/**
 * PRODUCT SEARCHER - Single responsibility: Search products only
 */
export interface IProductSearcher {
  search(query: string, filters?: ProductFilters, options?: SearchOptions): Promise<SearchResult<any>>;
  searchByCategory(category: string, query?: string, options?: SearchOptions): Promise<SearchResult<any>>;
}

/**
 * SET SEARCHER - Single responsibility: Search sets only
 */
export interface ISetSearcher {
  search(query: string, filters?: SetFilters, options?: SearchOptions): Promise<SearchResult<any>>;
  searchByYear(year: number, query?: string, options?: SearchOptions): Promise<SearchResult<any>>;
  searchBySeries(series: string, query?: string, options?: SearchOptions): Promise<SearchResult<any>>;
}

/**
 * SEARCH ENGINE - Single responsibility: Core search implementation
 */
export interface ISearchEngine {
  buildIndex(documents: any[], fields: string[]): Promise<void>;
  query(query: string, options?: any): Promise<any[]>;
  addDocument(document: any): Promise<void>;
  removeDocument(id: string): Promise<void>;
}

/**
 * QUERY PROCESSOR - Single responsibility: Process and prepare queries
 */
export interface ISearchQueryProcessor {
  parseQuery(rawQuery: string): ProcessedQuery;
  applyFilters(query: ProcessedQuery, filters: SearchFilters): ProcessedQuery;
  buildSearchTerms(query: string): string[];
}

/**
 * SEARCH ORCHESTRATOR - Single responsibility: Coordinate search workflow
 */
export interface ISearchOrchestrator {
  search(entityType: 'cards' | 'products' | 'sets', query: string, filters?: SearchFilters, options?: SearchOptions): Promise<SearchResult<any>>;
  multiEntitySearch(query: string, entityTypes: string[], options?: SearchOptions): Promise<{ [entityType: string]: SearchResult<any> }>;
  getSearchSuggestions(query: string, entityType?: string): Promise<string[]>;
}