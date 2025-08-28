/**
 * Search Configurations
 *
 * Centralized configuration for entity-specific search behaviors.
 * Defines searchable fields, weights, population paths, and scoring algorithms
 * for each entity type to eliminate duplication across repositories.
 */

const SEARCH_CONFIGS = {
  cards: {
    // Primary searchable fields with weights for relevance scoring
    fields: [
      { name: 'cardName', weight: 3, exactMatchBonus: 100 },
      { name: 'cardNumber', weight: 2, exactMatchBonus: 80 },
      { name: 'variety', weight: 1, exactMatchBonus: 60 }
    ],

    // Population configuration for relationships
    population: {
      path: 'setId',
      model: 'Set',
      conditionalFields: ['setName', 'year'] // Fields that require populate filtering
    },

    // Filter mappings for advanced search
    filters: {
      direct: ['setId', 'uniqueSetId', 'cardNumber', 'variety', 'uniquePokemonId'],
      regex: ['variety'],
      population: ['setName', 'year'],
      range: ['minGradedPopulation'],
      gradeSpecific: ['grade', 'minGradeCount']
    },

    // Default sorting and scoring
    scoring: {
      algorithm: 'cardSpecific',
      defaultSort: { 'grades.grade_total': -1, cardName: 1 },
      querySort: { score: -1, 'grades.grade_total': -1, cardName: 1 },
      bonusFields: [
        { field: 'grades.grade_total', divisor: 1000, max: 10 }
      ]
    },

    // Suggestion format
    suggestions: {
      primaryText: 'cardName',
      secondaryText: 'variety',
      metadata: ['cardNumber', 'variety', 'uniquePokemonId', 'setName', 'year', 'totalGraded', 'grades']
    }
  },

  sets: {
    fields: [
      { name: 'setName', weight: 3, exactMatchBonus: 100 }
    ],

    population: null, // No population needed

    filters: {
      direct: ['year', 'uniqueSetId'],
      range: ['minGradedPopulation', 'minCardCount', 'minGrade10Count'],
      rangeFields: ['yearRange', 'gradedPopulationRange', 'cardCountRange']
    },

    scoring: {
      algorithm: 'aggregation', // Use MongoDB aggregation for complex scoring
      defaultSort: { year: -1, setName: 1 },
      querySort: { score: -1, 'total_grades.total_graded': -1, year: -1 },
      stages: [
        {
          type: 'exactMatch',
          field: 'setName',
          score: 100
        },
        {
          type: 'startsWith',
          field: 'setName',
          score: 80
        },
        {
          type: 'contains',
          field: 'setName',
          score: 60
        },
        {
          type: 'wordBoundary',
          field: 'setName',
          score: 40
        },
        {
          type: 'popularity',
          field: 'total_grades.total_graded',
          divisor: 10000
        },
        {
          type: 'lengthPenalty',
          field: 'setName',
          base: 50
        }
      ]
    },

    suggestions: {
      primaryText: 'setName',
      secondaryText: 'year',
      metadata: ['year', 'totalCards', 'totalGraded', 'uniqueSetId', 'setUrl', 'era', 'grades']
    }
  },

  products: {
    fields: [
      { name: 'productName', weight: 3, exactMatchBonus: 100 },
      { name: 'category', weight: 1, exactMatchBonus: 30 }
    ],

    population: {
      path: 'setProductId',
      model: 'SetProduct',
      alias: 'setProduct',
      searchFields: ['setProduct.setProductName'] // Additional searchable fields from population
    },

    filters: {
      direct: ['category', 'setProductId'],
      range: ['priceRange', 'minAvailable'],
      boolean: ['availableOnly'],
      computed: ['priceNumeric'] // Fields that need computation
    },

    scoring: {
      algorithm: 'aggregation',
      defaultSort: { available: -1, price: 1 },
      querySort: { score: -1, available: -1, priceNumeric: 1 },
      stages: [
        {
          type: 'exactMatch',
          field: 'productName',
          score: 100
        },
        {
          type: 'exactMatch',
          field: 'setProduct.setProductName',
          score: 80
        },
        {
          type: 'startsWith',
          field: 'productName',
          score: 70
        },
        {
          type: 'startsWith',
          field: 'setProduct.setProductName',
          score: 60
        },
        {
          type: 'contains',
          field: 'productName',
          score: 50
        },
        {
          type: 'contains',
          field: 'setProduct.setProductName',
          score: 40
        },
        {
          type: 'contains',
          field: 'category',
          score: 30
        },
        {
          type: 'priceScore',
          field: 'priceNumeric',
          base: 1000
        },
        {
          type: 'availabilityScore',
          field: 'available',
          divisor: 100
        }
      ]
    },

    suggestions: {
      primaryText: 'productName',
      secondaryText: 'setProduct.setProductName',
      defaultSecondary: 'Unknown Set',
      metadata: ['category', 'price', 'priceNumeric', 'available', 'setProductId', 'setProductName', 'isAvailable']
    }
  },

  setProducts: {
    fields: [
      { name: 'setProductName', weight: 3, exactMatchBonus: 100 }
    ],

    population: null,

    filters: {
      direct: ['uniqueSetProductId'],
      regex: ['setProductName']
    },

    scoring: {
      algorithm: 'simple', // Just basic regex matching
      defaultSort: { setProductName: 1 },
      querySort: { setProductName: 1 }
    },

    suggestions: {
      primaryText: 'setProductName',
      secondaryText: null,
      metadata: ['uniqueSetProductId', 'setProductName']
    }
  }
};

/**
 * Scoring algorithm implementations
 */
const SCORING_ALGORITHMS = {
  cardSpecific: 'client-side',
  aggregation: 'mongodb-pipeline',
  simple: 'basic-sort'
};

/**
 * Field type mappings for query building
 */
const FIELD_TYPES = {
  text: ['cardName', 'setName', 'productName', 'setProductName', 'variety', 'category'],
  numeric: ['year', 'price', 'available', 'uniqueSetId', 'uniquePokemonId', 'uniqueSetProductId'],
  objectId: ['setId', 'setProductId'],
  nested: ['grades', 'total_grades'],
  computed: ['priceNumeric']
};

/**
 * Common filter operators
 */
const FILTER_OPERATORS = {
  regex: (value) => ({ $regex: value, $options: 'i' }),
  range: (min, max) => ({ $gte: min, $lte: max }),
  gte: (value) => ({ $gte: value }),
  gt: (value) => ({ $gt: value }),
  exact: (value) => value,
  exists: () => ({ $exists: true, $ne: null })
};

export {
  SEARCH_CONFIGS,
  SCORING_ALGORITHMS,
  FIELD_TYPES,
  FILTER_OPERATORS
};
export default SEARCH_CONFIGS; ;
