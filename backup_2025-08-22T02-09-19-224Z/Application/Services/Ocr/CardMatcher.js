/**
 * Card Matcher Service
 * 
 * SINGLE RESPONSIBILITY: Find card matches from parsed data
 * NO OTHER RESPONSIBILITIES: extraction, parsing, scoring
 */

/**
 * Database Card Matcher
 */
export class DatabaseCardMatcher {
  constructor(cardRepository, setRepository) {
    this.cardRepository = cardRepository;
    this.setRepository = setRepository;
  }

  /**
   * Find card matches from parsed data
   */
  async findCardMatches(parsedData, options = {}) {
    const { limit = 10, threshold = 0.1 } = options;
    const matches = [];

    try {
      // Strategy 1: Exact name + number match
      if (parsedData.pokemonName && parsedData.cardNumber) {
        const exactMatches = await this.findExactMatches(parsedData);
        matches.push(...exactMatches);
      }

      // Strategy 2: Name-only fuzzy match
      if (parsedData.pokemonName && matches.length < limit) {
        const nameMatches = await this.findByName(parsedData.pokemonName, { 
          limit: limit - matches.length,
          threshold 
        });
        matches.push(...nameMatches.filter(m => !matches.some(existing => existing.cardId === m.cardId)));
      }

      // Strategy 3: Number + Set match
      if (parsedData.cardNumber && parsedData.setName && matches.length < limit) {
        const numberMatches = await this.findByNumber(parsedData.cardNumber, parsedData.setName, {
          limit: limit - matches.length,
          threshold
        });
        matches.push(...numberMatches.filter(m => !matches.some(existing => existing.cardId === m.cardId)));
      }

      // Strategy 4: Set-based fuzzy search
      if (parsedData.setName && matches.length < limit) {
        const setMatches = await this.findBySet(parsedData.setName, parsedData.pokemonName, {
          limit: limit - matches.length,
          threshold
        });
        matches.push(...setMatches.filter(m => !matches.some(existing => existing.cardId === m.cardId)));
      }

      return matches.slice(0, limit);

    } catch (error) {
      console.error('❌ Card matching failed:', error);
      return [];
    }
  }

  /**
   * Find cards by name with fuzzy matching
   */
  async findByName(name, options = {}) {
    const { limit = 10 } = options;
    
    try {
      const cards = await this.cardRepository.findAll({
        $or: [
          { cardName: { $regex: name, $options: 'i' } },
          { $text: { $search: name } }
        ]
      }, { limit });

      return cards.map((card) => this.mapCardToMatch(card, 'name-fuzzy'));

    } catch (error) {
      console.error('❌ Name-based card search failed:', error);
      return [];
    }
  }

  /**
   * Find cards by number and set
   */
  async findByNumber(number, setName, options = {}) {
    const { limit = 10 } = options;
    
    try {
      const sets = await this.setRepository.findAll({
        setName: { $regex: setName, $options: 'i' }
      }, { limit: 5 });

      if (sets.length === 0) return [];

      const setIds = sets.map((set) => set._id);

      const cards = await this.cardRepository.findAll({
        cardNumber: { $in: [number, number.padStart(3, '0'), number.padStart(2, '0')] },
        setId: { $in: setIds }
      }, { limit });

      return cards.map((card) => this.mapCardToMatch(card, 'number-set'));

    } catch (error) {
      console.error('❌ Number-based card search failed:', error);
      return [];
    }
  }

  /**
   * Find exact matches (name + number)
   */
  async findExactMatches(parsedData) {
    try {
      const cards = await this.cardRepository.findAll({
        $and: [
          { cardName: { $regex: parsedData.pokemonName, $options: 'i' } },
          { cardNumber: { $in: [parsedData.cardNumber, parsedData.cardNumber.padStart(3, '0')] } }
        ]
      }, { limit: 5 });

      return cards.map((card) => this.mapCardToMatch(card, 'exact'));

    } catch (error) {
      console.error('❌ Exact match search failed:', error);
      return [];
    }
  }

  /**
   * Find cards by set with optional name filter
   */
  async findBySet(setName, pokemonName, options = {}) {
    const { limit = 10 } = options;
    
    try {
      const sets = await this.setRepository.findAll({
        setName: { $regex: setName, $options: 'i' }
      }, { limit: 3 });

      if (sets.length === 0) return [];

      const setIds = sets.map((set) => set._id);

      const cardQuery = { setId: { $in: setIds } };
      
      if (pokemonName) {
        cardQuery.cardName = { $regex: pokemonName, $options: 'i' };
      }

      const cards = await this.cardRepository.findAll(cardQuery, { limit });

      return cards.map((card) => this.mapCardToMatch(card, 'set-based'));

    } catch (error) {
      console.error('❌ Set-based card search failed:', error);
      return [];
    }
  }

  /**
   * Map database card to match format
   */
  mapCardToMatch(card, strategy) {
    return {
      cardId: card._id.toString(),
      cardName: card.cardName || 'Unknown Card',
      cardNumber: card.cardNumber || 'Unknown',
      setName: card.setId?.setName || 'Unknown Set',
      setId: card.setId?._id?.toString() || '',
      year: card.setId?.year || card.year,
      confidence: this.calculateBaseConfidence(strategy),
      matchStrategy: strategy,
      data: card
    };
  }

  /**
   * Calculate base confidence by strategy
   */
  calculateBaseConfidence(strategy) {
    const confidenceMap = {
      'exact': 0.95,
      'number-set': 0.85,
      'name-fuzzy': 0.70,
      'set-based': 0.60
    };

    return confidenceMap[strategy] || 0.50;
  }
}

/**
 * Card Matcher Factory
 */
export class CardMatcherFactory {
  static create(cardRepository, setRepository) {
    console.log('🗃️ Using Database Card Matcher');
    return new DatabaseCardMatcher(cardRepository, setRepository);
  }
}