export interface DictionaryConfig {
  /** The URL/path to the dictionary file to use */
  url: string;
  /** Minimum word length to include */
  minWordLength: number;
  /** Maximum word length to include */
  maxWordLength: number;
}

export const DEFAULT_DICTIONARY_CONFIG: DictionaryConfig = {
  url: "/core.normalized.txt",
  minWordLength: 2,
  maxWordLength: 15,
};
