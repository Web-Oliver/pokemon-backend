import mongoose from 'mongoose';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 🚨 CRITICAL: API Call Tracking Model
 * EVERY SINGLE API CALL MUST BE LOGGED TO PREVENT UNEXPECTED BILLING
 */
const ApiCallSchema = new mongoose.Schema({
    provider: { type: String, required: true, default: 'google-vision' },
    endpoint: { type: String, required: true },
    requestSize: { type: Number, required: true }, // bytes or request units
    responseTime: { type: Number, required: true }, // milliseconds
    success: { type: Boolean, required: true },
    cost: { type: Number, required: true, default: 0 }, // estimated cost in USD
    features: [{ type: String }], // features used (e.g., 'TEXT_DETECTION', 'LABEL_DETECTION')
    timestamp: { type: Date, default: Date.now },
    metadata: {
        imageCount: Number,
        totalBytes: Number,
        processingTime: Number,
        quotaRemaining: Number
    }
});

// 🚨 CRITICAL INDEXES FOR QUOTA ENFORCEMENT
ApiCallSchema.index({ provider: 1, timestamp: 1 });
ApiCallSchema.index({ provider: 1, 'timestamp': 1, success: 1 });

const ApiCall = mongoose.model('ApiCall', ApiCallSchema);

/**
 * 🚨 CRITICAL: 100% INDEPENDENT API Call Tracker Service
 * SELF-CONTAINED: ONLY USES DATABASE + JSON FILES + GOOGLE BILLING API
 * NO EXTERNAL DEPENDENCIES - COMPLETELY STANDALONE BILLING PROTECTION
 */
class ApiCallTracker {
    constructor() {
        this.trackingDir = path.join(process.cwd(), 'api-tracking');
        this.quotaLimits = {
            FREE_TIER_LIMIT: 1000, // Google Vision free tier
            DAILY_SAFETY_LIMIT: 100, // Conservative daily limit
            MONTHLY_COST_LIMIT: 10.00, // $10 monthly cost limit
            RATE_LIMIT_PER_MINUTE: 60, // 60 calls per minute
            COST_PER_UNIT: 0.0015 // $1.50 per 1000 units
        };
        this.ensureTrackingDir();
    }

    /**
     * 🚨 CRITICAL: 100% INDEPENDENT quota safety check
     * ONLY USES: Database records + JSON backup files + hardcoded limits
     */
    async checkQuotaSafety(provider = 'google-vision') {
        try {
            console.log('🛡️ [INDEPENDENT API SAFETY] Self-contained quota check starting...');

            // Get counts directly from database (self-contained)
            const [monthlyCount, dailyCount, monthlyCost, dailyCost] = await Promise.all([
                this.getMonthlyCallCount(provider),
                this.getTodaysCallCount(provider),
                this.getMonthlyCost(provider),
                this.getTodaysCost(provider)
            ]);

            const safety = {
                safe: true,
                reasons: [],
                monthlyCount,
                dailyCount,
                monthlyCost: monthlyCost.totalCost,
                dailyCost: dailyCost.totalCost
            };

            // INDEPENDENT QUOTA ENFORCEMENT
            if (monthlyCount >= this.quotaLimits.FREE_TIER_LIMIT) {
                safety.safe = false;
                safety.reasons.push(`Monthly quota exceeded: ${monthlyCount}/${this.quotaLimits.FREE_TIER_LIMIT}`);
            }

            if (dailyCount >= this.quotaLimits.DAILY_SAFETY_LIMIT) {
                safety.safe = false;
                safety.reasons.push(`Daily safety limit exceeded: ${dailyCount}/${this.quotaLimits.DAILY_SAFETY_LIMIT}`);
            }

            if (monthlyCost.totalCost >= this.quotaLimits.MONTHLY_COST_LIMIT) {
                safety.safe = false;
                safety.reasons.push(`Monthly cost limit exceeded: $${monthlyCost.totalCost.toFixed(2)}/$${this.quotaLimits.MONTHLY_COST_LIMIT}`);
            }

            console.log('🛡️ [INDEPENDENT API SAFETY] Self-contained quota check result:', {
                safe: safety.safe,
                monthlyCount: safety.monthlyCount,
                dailyCount: safety.dailyCount,
                monthlyCost: safety.monthlyCost,
                reasons: safety.reasons
            });

            if (!safety.safe) {
                const errorMsg = `🚨 INDEPENDENT API CALL BLOCKED: ${safety.reasons.join(', ')}`;

                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            console.log('✅ [INDEPENDENT API SAFETY] Self-contained quota check passed - API call authorized');
            return safety;

        } catch (error) {
            console.error('🚨 [INDEPENDENT API SAFETY] Self-contained quota check failed:', error.message);
            throw error;
        }
    }

    /**
     * 🚨 CRITICAL: Log API call start and get tracking ID
     */
    async startApiCall(provider, method, requestData) {
        try {
            // Generate unique request ID
            const requestId = crypto.randomBytes(16).toString('hex');
            const timestamp = new Date();

            console.log('📝 [API TRACKING] Starting API call logging:', {
                requestId,
                provider,
                method,
                timestamp: timestamp.toISOString()
            });

            // Get call numbers for tracking (self-contained)
            const dailyCount = await this.getTodaysCallCount(provider);
            const monthlyCount = await this.getMonthlyCallCount(provider);

            const apiCallData = {
                provider,
                method,
                requestId,
                timestamp,
                imageSize: requestData.imageSize || 0,
                imageCount: requestData.imageCount || 1,
                cost: requestData.cost || 0.0015,
                dailyCallNumber: dailyCount + 1,
                monthlyCallNumber: monthlyCount + 1,
                success: false, // Will update on completion
                responseTime: 0, // Will update on completion
                sessionId: requestData.sessionId || 'unknown'
            };

            // Save to database immediately
            const apiCall = new ApiCall(apiCallData);

            await apiCall.save();

            console.log('✅ [API TRACKING] API call logged to database:', {
                requestId,
                dailyCallNumber: apiCallData.dailyCallNumber,
                monthlyCallNumber: apiCallData.monthlyCallNumber
            });

            return {
                requestId,
                apiCall,
                startTime: Date.now()
            };

        } catch (error) {
            console.error('🚨 [API TRACKING] Failed to start API call logging:', error);
            throw error;
        }
    }

    /**
     * 🚨 CRITICAL: Log API call completion
     */
    async completeApiCall(requestId, startTime, result, error = null) {
        try {
            const responseTime = Date.now() - startTime;
            const success = !error && Boolean(result);

            console.log('📝 [API TRACKING] Completing API call logging:', {
                requestId,
                success,
                responseTime,
                hasError: Boolean(error)
            });

            // Update database record
            const updateData = {
                success,
                responseTime,
                textExtracted: result?.text?.length || 0,
                confidence: result?.confidence || 0
            };

            if (error) {
                updateData.errorMessage = error.message;
                updateData.errorCode = error.code || 'unknown';
            }

            const updatedApiCall = await ApiCall.findOneAndUpdate(
                { requestId },
                updateData,
                { new: true }
            );

            if (!updatedApiCall) {
                throw new Error(`API call record not found for requestId: ${requestId}`);
            }

            // Save to JSON file backup
            await this.saveToJsonBackup(updatedApiCall.toObject());

            console.log('✅ [API TRACKING] API call completed and logged:', {
                requestId,
                success,
                responseTime,
                dailyCallNumber: updatedApiCall.dailyCallNumber,
                cost: updatedApiCall.cost
            });

            return updatedApiCall;

        } catch (trackingError) {
            console.error('🚨 [API TRACKING] Failed to complete API call logging:', trackingError);
            // Don't throw - we don't want tracking issues to break the main flow
            return null;
        }
    }

    /**
     * 🚨 CRITICAL: Save to JSON file backup
     */
    async saveToJsonBackup(apiCallData) {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const jsonFile = path.join(this.trackingDir, `api-calls-${today}.json`);

            let existingData = [];

            try {
                const fileContent = await fs.readFile(jsonFile, 'utf8');

                existingData = JSON.parse(fileContent);
            } catch {
                // File doesn't exist yet, start with empty array
                existingData = [];
            }

            // Add new call
            existingData.push({
                ...apiCallData,
                backupTimestamp: new Date().toISOString()
            });

            // Write back to file
            await fs.writeFile(jsonFile, JSON.stringify(existingData, null, 2));

            console.log('✅ [JSON BACKUP] API call saved to JSON file:', jsonFile);

        } catch (error) {
            console.error('🚨 [JSON BACKUP] Failed to save to JSON file:', error);
            // Don't throw - backup failure shouldn't break main flow
        }
    }

    /**
     * 🚨 CRITICAL: 100% INDEPENDENT usage statistics
     * ONLY USES: Own methods + hardcoded limits
     */
    async getUsageStats(provider = 'google-vision') {
        try {
            const [dailyCount, monthlyCount, dailyCost, monthlyCost] = await Promise.all([
                this.getTodaysCallCount(provider),
                this.getMonthlyCallCount(provider),
                this.getTodaysCost(provider),
                this.getMonthlyCost(provider)
            ]);

            return {
                daily: {
                    calls: dailyCount,
                    cost: dailyCost.totalCost
                },
                monthly: {
                    calls: monthlyCount,
                    cost: monthlyCost.totalCost
                },
                limits: this.quotaLimits,
                independent: true,
                selfContained: true
            };

        } catch (error) {
            console.error('🚨 [INDEPENDENT USAGE STATS] Failed to get usage statistics:', error);
            throw error;
        }
    }

    /**
     * 🚨 INDEPENDENT: Database query methods (self-contained)
     */
    async getTodaysCallCount(provider = 'google-vision') {
        const startOfDay = new Date();

        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();

        endOfDay.setHours(23, 59, 59, 999);

        return await ApiCall.countDocuments({
            provider,
            timestamp: { $gte: startOfDay, $lte: endOfDay },
            success: true
        });
    }

    async getMonthlyCallCount(provider = 'google-vision') {
        const startOfMonth = new Date();

        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date();

        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        endOfMonth.setHours(23, 59, 59, 999);

        return await ApiCall.countDocuments({
            provider,
            timestamp: { $gte: startOfMonth, $lte: endOfMonth },
            success: true
        });
    }

    async getTodaysCost(provider = 'google-vision') {
        const startOfDay = new Date();

        startOfDay.setHours(0, 0, 0, 0);

        const result = await ApiCall.aggregate([
            {
                $match: {
                    provider,
                    timestamp: { $gte: startOfDay },
                    success: true
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$cost' },
                    totalCalls: { $sum: 1 }
                }
            }
        ]);

        return result[0] || { totalCost: 0, totalCalls: 0 };
    }

    async getMonthlyCost(provider = 'google-vision') {
        const startOfMonth = new Date();

        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const result = await ApiCall.aggregate([
            {
                $match: {
                    provider,
                    timestamp: { $gte: startOfMonth },
                    success: true
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$cost' },
                    totalCalls: { $sum: 1 }
                }
            }
        ]);

        return result[0] || { totalCost: 0, totalCalls: 0 };
    }

    /**
     * Ensure tracking directory exists
     */
    async ensureTrackingDir() {
        try {
            await fs.mkdir(this.trackingDir, { recursive: true });
        } catch (error) {
            console.error('🚨 [SETUP] Failed to create tracking directory:', error);
        }
    }
}

export default new ApiCallTracker();
