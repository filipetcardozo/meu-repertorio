import { liteClient } from 'algoliasearch/lite';

// Chave pública de busca (search-only) do Algolia.
export const ALGOLIA_LYRICS_INDEX = 'lyrics';
export const searchClient = liteClient('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');
