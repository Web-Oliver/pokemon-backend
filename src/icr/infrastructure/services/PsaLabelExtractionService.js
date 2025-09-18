/**
 * ICR PSA Label Extraction Service
 * Computer vision based PSA red label detection using HSV color filtering
 */

import sharp from 'sharp';

// Simple console logging since we don't have the full system here

class PsaLabelExtractionService {
    constructor() {
        // Red color range in HSV for PSA labels
        this.PSA_RED_LOWER = [0, 50, 50]; // Lower HSV threshold for red
        this.PSA_RED_UPPER = [20, 255, 255]; // Upper HSV threshold for red
        this.PSA_RED_LOWER2 = [160, 50, 50]; // Second red range (hue wraparound)
        this.PSA_RED_UPPER2 = [180, 255, 255];
    }

    /**
     * Extract PSA label using computer vision red detection
     */
    async extractPsaLabel(imageBuffer) {
        try {
            const startTime = Date.now();

            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            const { width, height } = metadata;

            console.log(`PsaLabelExtractionService: Analyzing image: ${width}x${height}`);

            // Find red region using computer vision
            let redRegion = await this.findRedLabelRegion(imageBuffer, width, height);

            if (!redRegion) {
                // Fallback to top region if no red found
                console.log('PsaLabelExtractionService: No red region found, using fallback');
                redRegion = this.getFallbackRegion(width, height);
            }

            console.log(`PsaLabelExtractionService: Extracting PSA label: ${JSON.stringify(redRegion)}`);

            // Extract the detected red label region
            const labelBuffer = await sharp(imageBuffer)
                .extract({
                    left: redRegion.x,
                    top: redRegion.y,
                    width: redRegion.width,
                    height: redRegion.height
                })
                .jpeg({ quality: 95 })
                .toBuffer();

            const processingTime = Date.now() - startTime;

            return {
                labelBuffer,
                cropRegion: redRegion,
                extractedDimensions: { width: redRegion.width, height: redRegion.height },
                processingTime,
                detectionMethod: redRegion.detected ? 'computer_vision' : 'fallback'
            };

        } catch (error) {
            console.error('PsaLabelExtractionService: PSA label extraction failed:', error);
            throw error;
        }
    }

    /**
     * Find red PSA label region using HSV color detection
     */
    async findRedLabelRegion(imageBuffer, width, height) {
        try {
            // Convert to RGB for HSV processing
            const { data } = await sharp(imageBuffer)
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Find red pixels in top 20% of image (where PSA labels are)
            const searchHeight = Math.floor(height * 0.2);
            const redPixels = [];

            for (let y = 0; y < searchHeight; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 3;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    // Convert RGB to HSV and check if it's red
                    const hsv = this.rgbToHsv(r, g, b);
                    if (this.isRedColor(hsv)) {
                        redPixels.push({ x, y });
                    }
                }
            }

            if (redPixels.length < 100) {
                return null; // Not enough red pixels found
            }

            // Find bounding box of red pixels
            const minX = Math.min(...redPixels.map(p => p.x));
            const maxX = Math.max(...redPixels.map(p => p.x));
            const minY = Math.min(...redPixels.map(p => p.y));
            const maxY = Math.max(...redPixels.map(p => p.y));

            // Add padding and ensure valid bounds
            const padding = 10;
            const x = Math.max(0, minX - padding);
            const y = Math.max(0, minY - padding);
            const maxWidth = width - x;
            const maxHeight = height - y;
            const regionWidth = Math.min(maxWidth, maxX - minX + 2 * padding);
            const regionHeight = Math.min(maxHeight, maxY - minY + 2 * padding);

            return {
                x: x,
                y: y,
                width: Math.max(1, regionWidth),
                height: Math.max(1, regionHeight),
                detected: true
            };

        } catch (error) {
            console.error('PsaLabelExtractionService: Red detection failed:', error);
            return null;
        }
    }

    /**
     * Convert RGB to HSV
     */
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        let h = 0;
        if (diff !== 0) {
            if (max === r) h = (60 * ((g - b) / diff) + 360) % 360;
            else if (max === g) h = (60 * ((b - r) / diff) + 120) % 360;
            else h = (60 * ((r - g) / diff) + 240) % 360;
        }

        const s = max === 0 ? 0 : diff / max;
        const v = max;

        return [h, s * 255, v * 255];
    }

    /**
     * Check if HSV color is red (PSA label red)
     */
    isRedColor(hsv) {
        const [h, s, v] = hsv;
        return (
            ((h >= this.PSA_RED_LOWER[0] && h <= this.PSA_RED_UPPER[0]) ||
                (h >= this.PSA_RED_LOWER2[0] && h <= this.PSA_RED_UPPER2[0])) &&
            s >= this.PSA_RED_LOWER[1] && s <= this.PSA_RED_UPPER[1] &&
            v >= this.PSA_RED_LOWER[2] && v <= this.PSA_RED_UPPER[2]
        );
    }

    /**
     * Fallback region if computer vision fails
     */
    getFallbackRegion(width, height) {
        return {
            x: Math.floor(width * 0.05),
            y: Math.floor(height * 0.02),
            width: Math.floor(width * 0.9),
            height: Math.floor(height * 0.15),
            detected: false
        };
    }
}

export default PsaLabelExtractionService;
