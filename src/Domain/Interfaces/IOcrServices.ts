/**
 * OCR Domain Service Interfaces
 * 
 * Defines contracts for OCR services with proper separation of concerns
 * Each interface has SINGLE responsibility, ZERO overlap
 */

export interface ParsedCardData {
  pokemonName?: string;
  cardNumber?: string;
  setName?: string;
  year?: number;
  grade?: string;
  certificationNumber?: string;
  originalText: string;
  confidence: number;
}

export interface CardMatch {
  cardId: string;
  cardName: string;
  cardNumber: string;
  setName: string;
  setId: string;
  year?: number;
  confidence: number;
  matchStrategy: string;
  data: any;
}

export interface PsaMatch {
  cardId: string;
  cardName: string;
  certificationNumber: string;
  grade: string;
  confidence: number;
  matchStrategy: string;
  data: any;
}

export interface MatchOptions {
  limit?: number;
  threshold?: number;
  strategy?: string;
  filters?: any;
}

export interface OcrResult {
  matches: (CardMatch | PsaMatch)[];
  extractedData: ParsedCardData;
  confidence: number;
  strategies: string[];
  totalCandidates: number;
  success: boolean;
  error?: string;
}

// ============ CORE OCR SERVICE INTERFACES ============

/**
 * TEXT EXTRACTION - Single responsibility: Extract text from images
 */
export interface IOcrTextExtractor {
  extractText(imageBuffer: Buffer): Promise<string>;
  extractTextFromPath(imagePath: string): Promise<string>;
}

/**
 * TEXT PARSING - Single responsibility: Parse OCR text into structured data
 */
export interface IOcrTextParser {
  parseCardInfo(ocrText: string): ParsedCardData;
  parsePsaInfo(ocrText: string): ParsedCardData;
  validateParsedData(data: ParsedCardData): boolean;
}

/**
 * CARD MATCHING - Single responsibility: Find card matches from parsed data
 */
export interface ICardMatcher {
  findCardMatches(parsedData: ParsedCardData, options?: MatchOptions): Promise<CardMatch[]>;
  findByName(name: string, options?: MatchOptions): Promise<CardMatch[]>;
  findByNumber(number: string, setName: string, options?: MatchOptions): Promise<CardMatch[]>;
}

/**
 * PSA MATCHING - Single responsibility: Find PSA matches from parsed data
 */
export interface IPsaMatcher {
  findPsaMatches(parsedData: ParsedCardData, options?: MatchOptions): Promise<PsaMatch[]>;
  findByCertificationNumber(certNumber: string): Promise<PsaMatch[]>;
}

/**
 * CONFIDENCE SCORING - Single responsibility: Score match confidence
 */
export interface IConfidenceScorer {
  scoreMatches<T extends CardMatch | PsaMatch>(matches: T[]): T[];
  calculateConfidence(match: CardMatch | PsaMatch, parsedData: ParsedCardData): number;
}

/**
 * OCR ORCHESTRATOR - Single responsibility: Coordinate OCR workflow
 */
export interface IOcrOrchestrator {
  processOcrText(ocrText: string, options?: MatchOptions): Promise<OcrResult>;
  processOcrImage(imageBuffer: Buffer, options?: MatchOptions): Promise<OcrResult>;
  processOcrBatch(texts: string[], options?: MatchOptions): Promise<OcrResult[]>;
}