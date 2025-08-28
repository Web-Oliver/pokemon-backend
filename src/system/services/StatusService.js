import BaseService from './BaseService.js';
import Card from '@/pokemon/cards/Card.js';
import Set from '@/pokemon/sets/Set.js';
import Product from '@/pokemon/products/Product.js';
import SetProduct from '@/pokemon/products/SetProduct.js';

/**
 * Service for handling system status and health checks
 */
export default class StatusService extends BaseService {
    constructor() {
        super();
    }

    /**
     * Get database collection counts
     * @returns {Promise<Object>} Collection counts and metadata
     */
    async getDatabaseCounts() {
        try {
            const [cardCount, setCount, productCount, setProductCount] = await Promise.all([
                Card.countDocuments(),
                Set.countDocuments(),
                Product.countDocuments(),
                SetProduct.countDocuments()
            ]);

            return {
                cards: cardCount,
                sets: setCount,
                products: productCount,
                setProducts: setProductCount,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Failed to get database counts', error);
            throw new Error('Database status check failed');
        }
    }

    /**
     * Get comprehensive system status
     * @returns {Promise<Object>} System status including DB health
     */
    async getSystemStatus() {
        const dbCounts = await this.getDatabaseCounts();

        return {
            status: 'healthy',
            database: {
                connected: true,
                collections: dbCounts
            },
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version
            }
        };
    }
}