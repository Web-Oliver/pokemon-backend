import {
    formatCardName,
    formatSealedProductName,
    getShortenedSetName,
    isJapaneseSet
} from '@/pokemon/products/pokemonNameShortener.js';

/**
 * Format item for Facebook post
 */
function formatItemForFacebook(data, category) {
    let formattedName = '';
    let price = '';

    switch (category) {
        case 'SealedProduct':
            const productName = data.productId?.productName;
            const setName = data.productId?.setProductId?.setProductName;

            formattedName = formatSealedProductName(productName, setName);
            const isJapaneseSealed = isJapaneseSet(setName);

            price = data.myPrice ? `${Math.round(parseFloat(data.myPrice.toString()))} Kr.` : 'N/A';
            return `* ${isJapaneseSealed ? 'Japanese ' : ''}${formattedName} Sealed - ${price}`;

        case 'PsaGradedCard':
            if (data.cardId && data.cardId.setId) {
                const cardName = formatCardName(data.cardId.cardName, data.cardId.cardNumber, data.cardId.variety);
                const setName = getShortenedSetName(data.cardId.setId.setName);
                const isJapanese = isJapaneseSet(data.cardId.setId.setName);

                if (isJapanese) {
                    formattedName = `Japanese ${setName} ${cardName} PSA ${data.grade}`;
                } else {
                    formattedName = `${setName} ${cardName} PSA ${data.grade}`;
                }
            } else {
                formattedName = `PSA Graded Card ${data.grade}`;
            }
            price = data.myPrice ? `${Math.round(parseFloat(data.myPrice.toString()))} Kr.` : 'N/A';
            return `* ${formattedName} - ${price}`;

        case 'RawCard':
            if (data.cardId && data.cardId.setId) {
                const cardName = formatCardName(data.cardId.cardName, data.cardId.cardNumber, data.cardId.variety);
                const setName = getShortenedSetName(data.cardId.setId.setName);
                const isJapanese = isJapaneseSet(data.cardId.setId.setName);

                if (isJapanese) {
                    formattedName = `Japanese ${setName} ${cardName}`;
                } else {
                    formattedName = `${setName} ${cardName}`;
                }
            } else {
                formattedName = 'Raw Card';
            }
            price = data.myPrice ? `${Math.round(parseFloat(data.myPrice.toString()))} Kr.` : 'N/A';
            return `* ${formattedName} - ${price}`;

        default:
            console.error(`Unknown category: ${category}`);
            return '';
    }
}

/**
 * Build Facebook post from grouped items
 */
function buildFacebookPost(groupedItems, topText, bottomText) {
    const facebookPostParts = [topText, ''];

    if (groupedItems.sealedProducts.length > 0) {
        facebookPostParts.push('🎁 SEALED PRODUCTS:');
        facebookPostParts.push(...groupedItems.sealedProducts);
        facebookPostParts.push('');
    }

    if (groupedItems.psaGradedCards.length > 0) {
        facebookPostParts.push('🏆 PSA CARDS:');
        facebookPostParts.push(...groupedItems.psaGradedCards);
        facebookPostParts.push('');
    }

    if (groupedItems.rawCards.length > 0) {
        facebookPostParts.push('🎴 RAW CARDS:');
        facebookPostParts.push(...groupedItems.rawCards);
        facebookPostParts.push('');
    }

    facebookPostParts.push(bottomText);
    return facebookPostParts.join('\n');
}

export {
    formatItemForFacebook,
    buildFacebookPost
};
export default formatItemForFacebook;

