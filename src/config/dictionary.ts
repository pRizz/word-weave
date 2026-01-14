export interface DictionaryConfig {
  /** The path suffix to the dictionary file (will be combined with base URL) */
  path: string;
  /** Minimum word length to include */
  minWordLength: number;
  /** Maximum word length to include */
  maxWordLength: number;
}

export const DEFAULT_DICTIONARY_CONFIG: DictionaryConfig = {
  path: "/core.normalized.txt",
  minWordLength: 2,
  maxWordLength: 15,
};
