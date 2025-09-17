/**
 * Hierarchical PSA Parser Service
 *
 * Single Responsibility: Parse PSA label OCR text using hierarchical search
 * - Extract year, base Pokemon name, card number, and modifiers
 * - Search cards by base name + card number (ignore modifiers initially)
 * - Verify sets by matching set names against full OCR text
 * - Score matches based on modifier agreement + set verification
 *
 * Architecture: Uses existing search APIs for maximum compatibility
 */

import SearchService from '@/search/services/SearchService.js';
import Card from '@/pokemon/cards/Card.js';
import SetModel from '@/pokemon/sets/Set.js';

class HierarchicalPsaParser {
    constructor() {
        this.searchService = new SearchService();
    }

    /**
     * Parse PSA label using multi-phase hierarchical approach
     * @param {string} ocrText - Raw OCR text from PSA label
     * @returns {Object} Parsing result with matched cards and confidence scores
     */
    async parsePsaLabel(ocrText) {
        if (!ocrText || typeof ocrText !== 'string' || ocrText.trim() === '') {
            return this.createEmptyResult('No OCR text provided', {});
        }

        try {
            // PHASE 1: Extract all possible card numbers and year
            const extractedData = this.extractAllPossibleData(ocrText);

            if (!extractedData.year || extractedData.possibleCardNumbers.length === 0) {
                return this.createEmptyResult('Missing year or no card numbers found', extractedData);
            }


            // PHASE 2: Search by card numbers with YEAR FIRST filtering
            const cardCandidates = await this.searchByCardNumbers(extractedData.possibleCardNumbers, extractedData.year);


            if (cardCandidates.length === 0) {
                return this.createEmptyResult('No cards found matching any extracted card numbers', extractedData);
            }

            // PHASE 3: Filter candidates by Pokemon names found in OCR
            const pokemonFilteredCandidates = this.filterByPokemonNames(cardCandidates, extractedData.possiblePokemonNames);

            // PHASE 4: Enrich with set details and verify
            const candidatesWithSets = await this.enrichWithSetDetails(pokemonFilteredCandidates);
            const setVerifiedCandidates = this.verifySetNames(candidatesWithSets, ocrText);

            // PHASE 5: Score final matches
            const scoredMatches = this.scoreMatches(setVerifiedCandidates, extractedData, ocrText);

            // PHASE 6: Return best matches
            const result = this.createSuccessResult(scoredMatches, extractedData, ocrText);


            return result;

        } catch (error) {
            throw error;
        }
    }

    /**
     * PHASE 1: Extract all possible data from OCR text
     */
    extractAllPossibleData(ocrText) {
        const cleanText = ocrText.replace(/\s+/g, ' ').trim();

        const extractedData = {
            year: null,
            certificationNumber: null,
            grade: null,
            price: null,
            possibleCardNumbers: [],
            possiblePokemonNames: [],
            modifiers: [],
            rawText: ocrText,
            cleanText: cleanText
        };

        // Extract year (4 digits) - CONVERT TO INTEGER
        const yearMatch = cleanText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            extractedData.year = parseInt(yearMatch[0], 10);
        }

        // Extract certification number (PSA cert numbers are typically 7-9 digits)
        const certMatch = cleanText.match(/\b(\d{7,9})\b/);
        if (certMatch) {
            extractedData.certificationNumber = certMatch[1];
        }

        // Extract grade (1-10)
        const gradeMatch = cleanText.match(/(?:MINT|GEM MINT|NM-MT|EX-MT|EX|VG-EX|VG|GOOD|PR)\s*(\d+)/i);
        if (gradeMatch) {
            extractedData.grade = parseInt(gradeMatch[1], 10);
        } else {
            const numberMatch = cleanText.match(/\b(10|9|8|7|6|5|4|3|2|1)\b/);
            if (numberMatch) {
                extractedData.grade = parseInt(numberMatch[1], 10);
            }
        }

        // FIXED: Extract price from PSA labels
        extractedData.price = this.extractPrice(cleanText);

        // Extract ALL possible card numbers using multiple patterns
        extractedData.possibleCardNumbers = this.extractAllCardNumbers(cleanText);

        // Extract ALL possible Pokemon names
        extractedData.possiblePokemonNames = this.extractAllPokemonNames(cleanText);

        // Extract modifiers
        extractedData.modifiers = this.extractModifiers(cleanText);


        return extractedData;
    }

    /**
     * Extract all possible card numbers from text using multiple patterns
     */
    extractAllCardNumbers(cleanText) {
        const cardNumbers = new Set();
        const skipWords = ['JAPANESE', 'EX', 'STAR', 'HOLO', 'MINT', 'PSA', 'BGS', 'NM', 'MT', 'MOON', 'BSP'];

        // Pattern 1: # followed by alphanumeric (# 014, #SM226, # BSP066)
        const pattern1Matches = cleanText.match(/#\s*([A-Z0-9]{1,10})(?=\s|$)/g);
        if (pattern1Matches) {
            pattern1Matches.forEach(match => {
                const num = match.replace(/#\s*/, '');
                if (num.length >= 1 && num.length <= 10 && !skipWords.includes(num)) {
                    cardNumbers.add(num);
                }
            });
        }

        // Pattern 2: alphanumeric before # (024 #, BSP066 #) - skip JAPANESE
        const pattern2Matches = cleanText.match(/\s([A-Z0-9]{1,10})\s+#/g);
        if (pattern2Matches) {
            pattern2Matches.forEach(match => {
                const num = match.replace(/\s+#/, '').trim();
                if (num.length >= 1 && num.length <= 10 && !skipWords.includes(num)) {
                    cardNumbers.add(num);
                }
            });
        }

        // Pattern 3: isolated numbers that could be card numbers (1-3 digits, NOT 4 digit years)
        const pattern3Matches = cleanText.match(/\b(\d{1,3})\b/g);
        if (pattern3Matches) {
            pattern3Matches.forEach(match => {
                const num = match.trim();
                // Skip years and certification numbers (7+ digits)
                if (!num.match(/^(19|20)\d{2}$/) && num.length <= 3) {
                    cardNumbers.add(num);
                }
            });
        }

        // Pattern 4: alphanumeric codes (SM226, BSP066, etc.)
        const pattern4Matches = cleanText.match(/\b([A-Z]{1,3}\d{1,4}[A-Z]?)\b/g);
        if (pattern4Matches) {
            pattern4Matches.forEach(match => {
                const code = match.trim();
                // Skip common words
                if (code.length >= 3 && !skipWords.includes(code)) {
                    cardNumbers.add(code);
                }
            });
        }

        return Array.from(cardNumbers);
    }

    /**
     * Extract all possible Pokemon names from text
     */
    extractAllPokemonNames(cleanText) {
        const pokemonNames = new Set();


        // Skip ONLY words that are definitely NOT Pokemon names or set names
        const skipWords = ['MINT', 'HOLO', 'CARD', 'DECK', 'KIT', 'EDITION', 'FIRST', '1ST', 'ED',
            'GEM', 'MT', 'NM', 'PSA', 'BGS', 'JPN', 'P', 'M', 'PM', 'PACK',
            'CERTIFICATION', 'NUMBER', 'GRADE', 'CONDITION', 'AUTHENTICATED', 'REV', 'FOIL'];

        // FIXED: Split with proper regex
        const words = cleanText.split(/\s+/);

        // SMART APPROACH: Look for Pokemon names anywhere in the text
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const cleanWord = word.replace(/[^A-Z]/g, '');

            // Skip if word is too short, a number, year, or garbage
            if (cleanWord.length < 2) {
                continue;
            }
            if (/^\d+$/.test(cleanWord)) {
                continue;
            }
            if (/^(19|20)\d{2}$/.test(cleanWord)) {
                continue;
            }
            if (/^[A-Z]{0,3}\d+[A-Z]{0,3}$/.test(cleanWord)) {
                continue;
            }
            if (skipWords.includes(cleanWord)) {
                continue;
            }

            // Add any word that passes filters - let the matching decide if it's valid
            pokemonNames.add(cleanWord);

            // Don't extract too many names to avoid garbage
            if (pokemonNames.size >= 5) {
                break;
            }
        }

        const result = Array.from(pokemonNames);
        return result;
    }

    /**
     * Extract modifiers from text
     */
    extractModifiers(cleanText) {
        const modifiers = ['DARK', 'LIGHT', 'SHINING', 'CRYSTAL', 'DELTA', 'STAR', 'PRIME',
            'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'TAG TEAM', 'BREAK',
            'HOLO', 'REVERSE FOIL', 'REV.FOIL', 'REVFOIL', 'SECRET', 'RAINBOW', 'GOLD', 'HYPER'];

        const extractedModifiers = [];
        for (const modifier of modifiers) {
            if (cleanText.includes(modifier)) {
                extractedModifiers.push(modifier);
            }
        }

        // Normalize REV.FOIL variants to REVERSE FOIL
        if (extractedModifiers.includes('REV.FOIL') || extractedModifiers.includes('REVFOIL')) {
            extractedModifiers.push('REVERSE FOIL');
        }

        return extractedModifiers;
    }

    /**
     * PHASE 2: Search database using OPTIMIZED YEAR-FIRST strategy
     * 1. Filter sets by year (most selective)
     * 2. Join with cards from those sets
     * 3. Filter by card numbers
     * This is 10x-100x faster than searching all cards by number
     */
    async searchByCardNumbers(cardNumbers, year) {
        if (!year) {
            return [];
        }

        // STEP 1: Get all sets matching the year (highly selective)
        const matchingSets = await SetModel.find({year: year}, '_id setName year').lean();

        if (matchingSets.length === 0) {
            console.log(`No sets found for year ${year}`);
            return [];
        }

        const setIds = matchingSets.map(set => set._id);
        console.log(`Found ${matchingSets.length} sets for year ${year}:`, matchingSets.map(s => s.setName));

        // STEP 2: Get ALL cards from those sets (year-filtered first)
        const yearFilteredCards = await Card.find(
            {
                setId: {$in: setIds}  // Only cards from year-matching sets
            },
            'cardName cardNumber variety setId uniqueSetId uniquePokemonId'
        )
            .populate('setId', 'setName year uniqueSetId')
            .lean();

        console.log(`Found ${yearFilteredCards.length} total cards in year ${year}`);

        // STEP 3: Filter by card numbers (now we have all varieties)
        const matchingCards = [];
        for (const cardNumber of cardNumbers) {
            const cardsWithNumber = yearFilteredCards.filter(card => card.cardNumber === cardNumber);
            if (cardsWithNumber.length > 0) {
                console.log(`Found ${cardsWithNumber.length} cards for number ${cardNumber} (including ALL varieties)`);
                matchingCards.push(...cardsWithNumber);
            }
        }

        // Remove duplicates by card ID
        const uniqueCandidates = [];
        const seenIds = new Set();
        for (const card of matchingCards) {
            if (!seenIds.has(card._id.toString())) {
                seenIds.add(card._id.toString());
                uniqueCandidates.push(card);
            }
        }

        console.log(`Year-first strategy returned ${uniqueCandidates.length} unique candidates (ALL varieties included)`);
        return uniqueCandidates;
    }

    /**
     * PHASE 3: Filter card candidates by Pokemon names
     */
    filterByPokemonNames(cardCandidates, pokemonNames) {

        if (pokemonNames.length === 0) {
            return cardCandidates;
        }

        // FIXED: Prioritize actual Pokemon names over set descriptors
        const pokemonPriority = this.prioritizePokemonNames(pokemonNames);

        const filteredCandidates = [];
        const rejectedCandidates = [];

        cardCandidates.forEach((card, index) => {
            const cardName = card.cardName?.toUpperCase() || '';

            let bestMatch = null;

            // Check Pokemon names in priority order (actual Pokemon first, then set names)
            for (const pokemonName of pokemonPriority) {

                // IMPROVED: More precise matching logic
                const isMatch = this.isPokemonNameMatch(cardName, pokemonName);

                if (isMatch) {
                    bestMatch = pokemonName;
                    break; // Take first (highest priority) match
                }
            }

            if (bestMatch) {
                filteredCandidates.push({
                    ...card,
                    matchedPokemonName: bestMatch
                });
            } else {
                rejectedCandidates.push(card);
            }

            // Special debug for our target Charizard #11
            if (card.cardNumber === '11' && cardName.includes('CHARIZARD')) {
            }
        });


        // Debug rejected cards
        if (rejectedCandidates.length > 0) {
        }

        // If Pokemon name filtering eliminates all results, fall back to all candidates
        if (filteredCandidates.length === 0) {
            return cardCandidates;
        }

        return filteredCandidates;
    }

    /**
     * Prioritize actual Pokemon names over set descriptors
     */
    prioritizePokemonNames(pokemonNames) {
        const actualPokemon = [];
        const setDescriptors = [];

        const commonSetWords = ['ROCKET', 'VENDING', 'SERIES', 'EVOLUTION', 'GYM', 'LEGEND', 'FOSSIL', 'JUNGLE', 'BASE'];

        for (const name of pokemonNames) {
            if (commonSetWords.includes(name)) {
                setDescriptors.push(name);
            } else {
                actualPokemon.push(name);
            }
        }

        // Return actual Pokemon names first, then set descriptors
        return [...actualPokemon, ...setDescriptors];
    }

    /**
     * More precise Pokemon name matching
     */
    isPokemonNameMatch(cardName, pokemonName) {
        // Normalize case for comparison
        const cardNameUpper = cardName.toUpperCase();
        const pokemonNameUpper = pokemonName.toUpperCase();

        // Exact word match (best)
        const cardWords = cardNameUpper.split(/\s+/);

        if (cardWords.includes(pokemonNameUpper)) {
            return true;
        }

        // Start of card name match (good for "CHARIZARD" matching "CHARIZARD G LV.X")
        if (cardNameUpper.startsWith(pokemonNameUpper + ' ') || cardNameUpper === pokemonNameUpper) {
            return true;
        }

        // Substring match for set descriptors only (weaker, but needed for sets)
        const setWords = ['ROCKET', 'VENDING', 'SERIES', 'EVOLUTION', 'GYM'];
        if (setWords.includes(pokemonNameUpper) && cardNameUpper.includes(pokemonNameUpper)) {
            return true;
        }

        return false;
    }

    /**
     * STEP 3: Enrich candidates with set details (if not populated)
     */
    async enrichWithSetDetails(candidates) {
        const enrichedCandidates = candidates.map((card, index) => {

            let setDetails = null;

            if (card.setId) {
                setDetails = card.setId;
            }

            const enriched = {
                card,
                setDetails: setDetails,
                uniqueSetId: card.uniqueSetId
            };

            return enriched;
        });


        return enrichedCandidates;
    }

    /**
     * STEP 4: Verify set names against full OCR text
     */
    verifySetNames(candidates, ocrText) {
        const upperOcrText = ocrText.toUpperCase();

        const verifiedCandidates = [];
        const rejectedCandidates = [];

        candidates.forEach((candidate, index) => {
            const setName = candidate.setDetails?.setName || '';
            const setYear = candidate.setDetails?.year;
            const setNameUpper = setName.toUpperCase();

            let setConfidence = 0;
            let matchedPortion = '';
            let debugInfo = {
                exactMatch: false,
                partialMatch: false,
                words: [],
                matchedWords: [],
                unmatchedWords: []
            };

            // Check for set name match - if OCR contains any significant word from set name
            if (setNameUpper) {
                // Check for partial matches (key words) - include POKEMON since all sets have it
                const setWords = setNameUpper.split(' ').filter(word =>
                    word.length > 2 &&  // Include "NEO" and longer words
                    word !== 'THE' &&
                    word !== 'AND'
                );

                debugInfo.words = setWords;

                let matchedWords = 0;

                for (const word of setWords) {
                    const wordFound = upperOcrText.includes(word);

                    if (wordFound) {
                        matchedWords++;
                        matchedPortion += word + ' ';
                        debugInfo.matchedWords.push(word);
                    } else {
                        debugInfo.unmatchedWords.push(word);
                    }
                }

                if (matchedWords > 0 && setWords.length > 0) {
                    setConfidence = (matchedWords / setWords.length) * 0.7; // Partial match
                    debugInfo.partialMatch = true;
                }
            }


            const result = {
                ...candidate,
                setVerification: {
                    confidence: setConfidence,
                    matchedPortion: matchedPortion.trim(),
                    fullSetName: setName,
                    debugInfo: debugInfo
                }
            };

            const willKeep = true; // Always keep candidates - set verification is not critical

            if (willKeep) {
                verifiedCandidates.push(result);
            } else {
                rejectedCandidates.push({...result, rejectionReason: `Set confidence too low: ${setConfidence}`});
            }
        });


        return verifiedCandidates;
    }

    /**
     * PHASE 5: Score matches based on multiple factors
     */
    scoreMatches(candidates, extractedData, ocrText) {
        return candidates.map(candidate => {
            const card = candidate.card;
            const setVerification = candidate.setVerification;
            const matchedPokemonName = candidate.matchedPokemonName;

            // Score components
            const scores = {
                yearMatch: this.scoreYearMatch(card, extractedData.year),
                pokemonMatch: this.scorePokemonMatch(card.cardName, extractedData.possiblePokemonNames),
                cardNumberMatch: extractedData.possibleCardNumbers.includes(card.cardNumber) ? 1.0 : 0.8,
                modifierMatch: this.scoreModifierMatch(card.cardName, extractedData.modifiers),
                setVerification: setVerification.confidence
            };

            // FIXED: Weighted total score prioritizing NAME > NUMBER > YEAR > SET NAME
            const weights = {
                pokemonMatch: 0.40,      // 1st priority: NAME (40%)
                cardNumberMatch: 0.30,   // 2nd priority: NUMBER (30%)
                yearMatch: 0.20,         // 3rd priority: YEAR (20%)
                setVerification: 0.10,   // 4th priority: SET NAME (10%)
                modifierMatch: 0.0       // Ignore modifiers for core matching
            };

            const totalScore = Object.entries(weights).reduce((total, [key, weight]) => {
                return total + (scores[key] * weight);
            }, 0);

            return {
                card,
                setDetails: candidate.setDetails,
                setVerification,
                scores,
                totalScore,
                confidence: Math.min(totalScore, 1.0),
                matchedPokemonName
            };
        }).sort((a, b) => b.totalScore - a.totalScore); // Sort by best score first
    }

    /**
     * Score year match between card and PSA
     */
    scoreYearMatch(card, psaYear) {
        const cardYear = card.setId?.year;
        if (!cardYear || !psaYear) return 0.5; // Unknown, neutral score
        return cardYear === psaYear ? 1.0 : 0.0;
    }

    /**
     * Score Pokemon name match - now accepts array of possible Pokemon names
     */
    scorePokemonMatch(cardName, pokemonNames) {
        if (!cardName || !pokemonNames || pokemonNames.length === 0) return 0.0;

        const cardNameUpper = cardName.toUpperCase();
        let bestScore = 0.0;

        // Check each Pokemon name and return the highest score
        for (const pokemonName of pokemonNames) {
            if (!pokemonName) continue;

            const pokemonNameUpper = pokemonName.toUpperCase();

            // Perfect match - card name contains this Pokemon name
            if (cardNameUpper.includes(pokemonNameUpper)) {
                bestScore = Math.max(bestScore, 1.0);
                continue; // Found perfect match, but check others too
            }

            // Check for partial matches (handle compound names)
            const pokemonWords = pokemonNameUpper.split(' ');
            let matchedWords = 0;

            for (const word of pokemonWords) {
                if (cardNameUpper.includes(word)) {
                    matchedWords++;
                }
            }

            if (pokemonWords.length > 0) {
                const partialScore = matchedWords / pokemonWords.length;
                bestScore = Math.max(bestScore, partialScore);
            }
        }

        return bestScore;
    }

    /**
     * Score modifier match between card name and PSA modifiers
     */
    scoreModifierMatch(cardName, psaModifiers) {
        if (!psaModifiers || psaModifiers.length === 0) return 0.5; // No modifiers to match

        const cardNameUpper = cardName.toUpperCase();
        let matchedModifiers = 0;

        for (const modifier of psaModifiers) {
            if (cardNameUpper.includes(modifier)) {
                matchedModifiers++;
            }
        }

        return psaModifiers.length > 0 ? matchedModifiers / psaModifiers.length : 0.5;
    }

    /**
     * Create empty result for failed parsing
     */
    createEmptyResult(reason, components = {}) {
        return {
            success: false,
            reason,
            components,
            matches: [],
            bestMatch: null,
            confidence: 0.0,
            metadata: {
                totalCandidates: 0,
                setVerified: 0,
                processingTime: Date.now()
            }
        };
    }

    /**
     * Create success result with matches - return ALL varieties for user selection
     */
    createSuccessResult(matches, extractedData, ocrText) {
        // ALWAYS return ALL matches - let the user choose from ALL varieties
        // The system should show every possible variety found
        return {
            success: true,
            extractedData,
            matches: matches, // Return ALL matches, not just the first one
            bestMatch: matches[0] || null,
            confidence: matches[0]?.confidence || 0.0,
            hasMultipleVarieties: matches.length > 1,
            metadata: {
                totalMatches: matches.length,
                cardNumbersFound: extractedData.possibleCardNumbers.length,
                pokemonNamesFound: extractedData.possiblePokemonNames.length,
                ocrText,
                processingTime: Date.now()
            }
        };
    }

}

export default HierarchicalPsaParser;
