/**
 * ExternalSongProvider - Base abstract provider for external song imports.
 * Future providers (ChordPro, CCLI/SongSelect, other authorized sources)
 * should extend this class.
 */
class ExternalSongProvider {
  constructor(name) {
    if (new.target === ExternalSongProvider) {
      throw new TypeError('Cannot construct ExternalSongProvider directly.');
    }
    this.name = name;
  }

  /**
   * Determine whether this provider can handle the given URL or identifier.
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    throw new Error("Method 'canHandle' must be implemented.");
  }

  /**
   * Fetch raw song data from the external source.
   * @param {string} url
   * @param {object} options
   * @returns {Promise<any>}
   */
  async fetchSong(url, options = {}) {
    throw new Error("Method 'fetchSong' must be implemented.");
  }

  /**
   * Search for songs matching a query string.
   * @param {string} query
   * @param {object} options
   * @returns {Promise<Array<object>>}
   */
  async search(query, options = {}) {
    throw new Error("Method 'search' must be implemented.");
  }

  /**
   * Parse raw payload into wPlanner's normalised song model.
   * @param {any} rawPayload
   * @param {string} sourceUrl
   * @returns {object} Normalised song object
   */
  parseSong(rawPayload, sourceUrl) {
    throw new Error("Method 'parseSong' must be implemented.");
  }
}

module.exports = ExternalSongProvider;
