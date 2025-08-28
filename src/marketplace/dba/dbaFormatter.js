import {
  formatCardName,
  formatSealedProductName,
  getShortenedSetName,
  isJapaneseSet,
} from '@/pokemon/products/pokemonNameShortener.js';

/**
 * Generate DBA title for item
 */
function generateDbaTitle(fetchedItem, itemCategory) {
  let dbaTitle = '';

  switch (itemCategory) {
    case 'SealedProduct':
      dbaTitle = `Pokemon ${formatSealedProductName(fetchedItem.name, fetchedItem.setName)}`;
      break;

    case 'PsaGradedCard':
      if (fetchedItem.cardId && fetchedItem.cardId.setId) {
        const cardName = formatCardName(
          fetchedItem.cardId.cardName,
          fetchedItem.cardId.pokemonNumber,
          fetchedItem.cardId.variety,
        );
        const setName = getShortenedSetName(fetchedItem.cardId.setId.setName);
        const isJapanese = isJapaneseSet(fetchedItem.cardId.setId.setName);

        dbaTitle = `Pokemon ${isJapanese ? 'Japanese ' : ''}${setName} ${cardName} ${fetchedItem.grade}`;
      } else {
        dbaTitle = `Pokemon PSA Graded Card ${fetchedItem.grade}`;
      }
      break;

    case 'RawCard':
      if (fetchedItem.cardId && fetchedItem.cardId.setId) {
        const cardName = formatCardName(
          fetchedItem.cardId.cardName,
          fetchedItem.cardId.pokemonNumber,
          fetchedItem.cardId.variety,
        );
        const setName = getShortenedSetName(fetchedItem.cardId.setId.setName);
        const isJapanese = isJapaneseSet(fetchedItem.cardId.setId.setName);

        dbaTitle = `Pokemon ${isJapanese ? 'Japanese ' : ''}${setName} ${cardName}`;
      } else {
        dbaTitle = 'Pokemon Card';
      }
      break;
    default:
      dbaTitle = 'Pokemon Item';
      break;
  }

  return dbaTitle;
}

export {
  generateDbaTitle
};
export default generateDbaTitle; ;
