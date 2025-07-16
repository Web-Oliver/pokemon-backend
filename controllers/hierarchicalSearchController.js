const searchService = require('../services/searchService');
const Card = require('../models/Card');
const Set = require('../models/Set');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const { validationResult } = require('express-validator');
const Fuse = require('fuse.js');

class HierarchicalSearchController {
  search = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { type, q: query, setContext, categoryContext, limit = 15 } = req.query;

      // Debug logging to track setContext parameter
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] Controller received - type: "${type}", query: "${query}", setContext: "${setContext}"`);
      }

      if (!type || !query) {
        return res.status(400).json({
          success: false,
          message: 'Both type and query parameters are required'
        });
      }

      // Context7/ReactiveSearch pattern: hierarchical filtering with proper context propagation
      let results;
      switch (type) {
        case 'sets':
          // Top-level search - no context filtering
          results = await this.searchSets(query, limit);
          break;
        case 'cards':
          // Second-level search - filtered by set context if provided
          results = await this.searchCards(query, setContext, limit);
          break;
        case 'productSets':
          // Product set search - for sealed product selection
          results = await this.searchProductSets(query, limit);
          break;
        case 'products':
          // Multi-level search - filtered by both set and category context
          results = await this.searchProducts(query, setContext, categoryContext, limit);
          break;
        case 'categories':
          // Top-level search for product categories - no context filtering
          results = await this.searchCategories(query, limit);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid search type. Must be one of: sets, cards, products, categories, productSets'
          });
      }

      res.json({
        success: true,
        type,
        query,
        setContext,
        categoryContext,
        results,
        count: results.length,
        meta: {
          hierarchical: true,
          contextApplied: {
            set: !!setContext,
            category: !!categoryContext
          }
        }
      });

    } catch (error) {
      console.error('Hierarchical search error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Internal server error during search',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async searchSets(query, limit) {
    try {
      // ReactiveSearch pattern: Use aggregation-based search for facet data
      // Get sets with aggregated counts from both cards and products
      const [cardSets, productSets] = await Promise.all([
        Set.aggregate([
          {
            $match: {
              setName: { $regex: query, $options: 'i' }
            }
          },
          {
            $lookup: {
              from: 'cards',
              localField: '_id',
              foreignField: 'setId', 
              as: 'cards'
            }
          },
          {
            $addFields: {
              cardCount: { $size: '$cards' },
              source: 'cards'
            }
          },
          {
            $project: {
              setName: 1,
              year: 1,
              cardCount: 1,
              source: 1,
              score: {
                $cond: {
                  if: { $eq: [{ $toLower: '$setName' }, query.toLowerCase()] },
                  then: 1.0,
                  else: {
                    $divide: [
                      { $strLenCP: query },
                      { $strLenCP: '$setName' }
                    ]
                  }
                }
              }
            }
          },
          { $sort: { score: -1, setName: 1 } },
          { $limit: parseInt(limit) }
        ]),
        
        CardMarketReferenceProduct.aggregate([
          {
            $match: {
              setName: { $regex: query, $options: 'i', $exists: true, $ne: '' }
            }
          },
          {
            $group: {
              _id: '$setName',
              productCount: { $sum: 1 },
              avgPrice: { 
                $avg: { 
                  $convert: { 
                    input: '$price', 
                    to: 'double', 
                    onError: null,
                    onNull: null 
                  } 
                } 
              }
            }
          },
          {
            $addFields: {
              setName: '$_id',
              source: 'products',
              score: {
                $cond: {
                  if: { $eq: [{ $toLower: '$_id' }, query.toLowerCase()] },
                  then: 1.0,
                  else: {
                    $divide: [
                      { $strLenCP: query },
                      { $strLenCP: '$_id' }
                    ]
                  }
                }
              }
            }
          },
          {
            $project: {
              setName: 1,
              productCount: 1,
              avgPrice: 1,
              source: 1,
              score: 1
            }
          },
          { $sort: { score: -1, setName: 1 } },
          { $limit: parseInt(limit) }
        ])
      ]);

      // Merge and deduplicate results, prioritizing card sets
      const resultMap = new Map();
      
      // Add card sets first (higher priority)
      cardSets.forEach(set => {
        resultMap.set(set.setName, {
          setName: set.setName,
          year: set.year,
          score: set.score,
          source: 'cards',
          isExactMatch: set.setName.toLowerCase() === query.toLowerCase(),
          counts: {
            cards: set.cardCount,
            products: 0
          }
        });
      });

      // Add product counts to existing card sets only (no product-only sets)
      productSets.forEach(set => {
        if (resultMap.has(set.setName)) {
          // Merge with existing card set
          const existing = resultMap.get(set.setName);
          existing.counts.products = set.productCount;
          existing.avgPrice = set.avgPrice;
        }
        // Removed: Do not add product-only sets to card search results
      });

      // Convert to array and sort by ReactiveSearch principles
      const results = Array.from(resultMap.values())
        .sort((a, b) => {
          // Exact matches first
          if (a.isExactMatch && !b.isExactMatch) return -1;
          if (!a.isExactMatch && b.isExactMatch) return 1;
          // Then by score and total count
          if (a.score !== b.score) return b.score - a.score;
          const aTotal = a.counts.cards + a.counts.products;
          const bTotal = b.counts.cards + b.counts.products;
          return bTotal - aTotal;
        })
        .slice(0, parseInt(limit));

      return results;

    } catch (error) {
      console.error('Set search error:', error);
      throw error;
    }
  }

  async searchCards(query, setContext, limit) {
    try {
      const searchOptions = {
        limit: parseInt(limit),
        includeSetInfo: true
      };

      // Apply hierarchical context filtering - ReactiveSearch pattern
      if (setContext) {
        searchOptions.setName = setContext;
      }
      
      const searchResult = await searchService.searchCards(query, searchOptions);
      
      const cardResults = searchResult.data || [];
      
      // If no setContext provided, include set information for auto-fill
      if (!setContext && cardResults.length > 0) {
        const cardsWithSets = await Promise.all(
          cardResults.map(async (card) => {
            if (card.setId) {
              const setInfo = await Set.findById(card.setId, { setName: 1, year: 1 }).lean();
              return {
                ...card,
                setInfo: setInfo ? {
                  setName: setInfo.setName,
                  year: setInfo.year
                } : null
              };
            }
            return card;
          })
        );
        return cardsWithSets;
      }

      return cardResults;

    } catch (error) {
      console.error('Card search error:', error);
      throw error;
    }
  }

  async searchProductSets(query, limit) {
    try {
      // Search for product sets (grouped by setName) - for sealed product selection
      const productSets = await CardMarketReferenceProduct.aggregate([
        {
          $match: {
            setName: { $regex: query, $options: 'i', $exists: true, $ne: '' }
          }
        },
        {
          $group: {
            _id: '$setName',
            productCount: { $sum: 1 },
            avgPrice: { 
              $avg: { 
                $convert: { 
                  input: '$price', 
                  to: 'double', 
                  onError: null,
                  onNull: null 
                } 
              } 
            }
          }
        },
        {
          $addFields: {
            setName: '$_id',
            source: 'products',
            score: {
              $cond: {
                if: { $eq: [{ $toLower: '$_id' }, query.toLowerCase()] },
                then: 1.0,
                else: {
                  $divide: [
                    { $strLenCP: query },
                    { $strLenCP: '$_id' }
                  ]
                }
              }
            }
          }
        },
        {
          $project: {
            setName: 1,
            productCount: 1,
            avgPrice: 1,
            source: 1,
            score: 1
          }
        },
        { $sort: { score: -1, setName: 1 } },
        { $limit: parseInt(limit) }
      ]);

      // Format results for product set selection
      const results = productSets.map(set => ({
        setName: set.setName,
        score: set.score,
        source: 'products',
        isExactMatch: set.setName.toLowerCase() === query.toLowerCase(),
        counts: {
          cards: 0,
          products: set.productCount
        },
        avgPrice: set.avgPrice
      }));

      return results;

    } catch (error) {
      console.error('Product set search error:', error);
      throw error;
    }
  }

  async searchProducts(query, setContext, categoryContext, limit) {
    try {
      // ReactiveSearch pattern: Build hierarchical filter aggregation
      const pipeline = [
        {
          $match: {
            $text: { $search: query }
          }
        },
        {
          $addFields: {
            score: { $meta: "textScore" },
            relevanceScore: {
              $cond: {
                if: { $eq: [{ $toLower: '$name' }, query.toLowerCase()] },
                then: 1.0,
                else: { $meta: "textScore" }
              }
            }
          }
        }
      ];

      // Apply hierarchical context filters following ReactiveSearch TreeList pattern
      if (setContext) {
        pipeline.push({
          $match: {
            setName: { $eq: setContext }
          }
        });
      }

      if (categoryContext) {
        pipeline.push({
          $match: {
            category: { $eq: categoryContext }
          }
        });
      }

      // Add final sorting and projection
      pipeline.push(
        {
          $sort: { 
            relevanceScore: -1, 
            score: -1, 
            available: -1,
            name: 1
          }
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            _id: 1,
            name: 1,
            setName: 1,
            category: 1,
            available: 1,
            price: 1,
            url: 1,
            score: 1,
            relevanceScore: 1,
            // ReactiveSearch pattern: Include context info for hierarchical navigation
            setInfo: {
              $cond: {
                if: { $ne: ['$setName', null] },
                then: { setName: '$setName' },
                else: null
              }
            },
            categoryInfo: {
              $cond: {
                if: { $ne: ['$category', null] },
                then: { category: '$category' },
                else: null
              }
            }
          }
        }
      );

      const products = await CardMarketReferenceProduct.aggregate(pipeline);
      return products;

    } catch (error) {
      console.error('Product search error:', error);
      throw error;
    }
  }

  async searchCategories(query, limit) {
    try {
      // Get all unique categories from CardMarketReferenceProduct
      const categories = await CardMarketReferenceProduct.distinct('category');
      
      // Filter categories based on query
      const filteredCategories = categories.filter(category => 
        category.toLowerCase().includes(query.toLowerCase())
      );

      // Count products in each matching category
      const categoryResults = await Promise.all(
        filteredCategories.slice(0, parseInt(limit)).map(async (category) => {
          const count = await CardMarketReferenceProduct.countDocuments({ category });
          return {
            category,
            productCount: count,
            isExactMatch: category.toLowerCase() === query.toLowerCase()
          };
        })
      );

      // Sort by exact match first, then by product count
      return categoryResults.sort((a, b) => {
        if (a.isExactMatch && !b.isExactMatch) return -1;
        if (!a.isExactMatch && b.isExactMatch) return 1;
        return b.productCount - a.productCount;
      });

    } catch (error) {
      console.error('Category search error:', error);
      throw error;
    }
  }
}

module.exports = new HierarchicalSearchController();