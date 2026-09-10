const assert = require('assert');
const mongoose = require('mongoose');
const Song = require('../models/Song');
const Church = require('../models/Church');
const { UltimateGuitarProvider, isPrivateIp, extractUgStoreData } = require('../services/songImport/UltimateGuitarProvider');
const { UltimateGuitarParser } = require('../services/songImport/UltimateGuitarParser');
const { SongImportService, defaultSongImportService } = require('../services/songImport/SongImportService');
const { parseSongToLiveSections } = require('../utils/songParser');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wplanner_test_import';

async function runImportTests() {
  console.log('=== Starting Ultimate Guitar Song Import Test Suite (27 Cases) ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB test database.');

  // Clean test collections
  await Church.deleteMany({});
  await Song.deleteMany({});

  const testChurch = await Church.create({
    name: 'Import Test Grace Church',
    churchCode: 'IMP001',
    plan: 'enterprise',
  });

  const provider = new UltimateGuitarProvider();
  const service = new SongImportService();

  try {
    // -------------------------------------------------------------
    // Test 1: Valid Ultimate Guitar URL
    // -------------------------------------------------------------
    console.log('Test 1: Valid Ultimate Guitar URL');
    const validUrl = 'https://tabs.ultimate-guitar.com/tab/chris-tomlin/amazing-grace-chords-12345';
    assert.strictEqual(provider.canHandle(validUrl), true, 'Provider should accept valid UG chord URL');

    // -------------------------------------------------------------
    // Test 2: Invalid URL
    // -------------------------------------------------------------
    console.log('Test 2: Invalid URL');
    await assert.rejects(
      async () => provider.validateUrl('not-a-valid-url'),
      (err) => err.statusCode === 400 && err.message.includes('Invalid URL'),
      'Should reject non-URL strings'
    );

    // -------------------------------------------------------------
    // Test 3: Arbitrary External URL
    // -------------------------------------------------------------
    console.log('Test 3: Arbitrary External URL');
    await assert.rejects(
      async () => provider.validateUrl('https://evil-site.com/tab/hacked'),
      (err) => err.statusCode === 400 && err.message.includes('Unsupported URL'),
      'Should reject arbitrary external non-UG domains'
    );

    // -------------------------------------------------------------
    // Test 4: Localhost URL (SSRF prevention)
    // -------------------------------------------------------------
    console.log('Test 4: Localhost URL');
    assert.strictEqual(provider.canHandle('http://localhost:3000/tab/song'), false);
    assert.strictEqual(isPrivateIp('127.0.0.1'), true, '127.0.0.1 must be recognized as private loopback');

    // -------------------------------------------------------------
    // Test 5: Private IP URL (SSRF prevention)
    // -------------------------------------------------------------
    console.log('Test 5: Private IP URL');
    assert.strictEqual(isPrivateIp('192.168.1.5'), true, '192.168.x.x must be blocked');
    assert.strictEqual(isPrivateIp('10.0.0.1'), true, '10.x.x.x must be blocked');
    assert.strictEqual(isPrivateIp('169.254.169.254'), true, 'AWS metadata IP must be blocked');
    assert.strictEqual(isPrivateIp('::1'), true, 'IPv6 loopback must be blocked');

    // -------------------------------------------------------------
    // Test 6: Unsupported Ultimate Guitar content type
    // -------------------------------------------------------------
    console.log('Test 6: Unsupported Ultimate Guitar content type');
    const forumUrl = 'https://tabs.ultimate-guitar.com/forum/general-discussion';
    assert.strictEqual(provider.canHandle(forumUrl), false, 'Forum URLs must not be handled as chord pages');
    await assert.rejects(
      async () => provider.validateUrl(forumUrl),
      (err) => err.statusCode === 400 && err.message.includes('/tab/'),
      'Should reject non-tab UG pages'
    );

    // -------------------------------------------------------------
    // Test 7: Song with simple chords
    // -------------------------------------------------------------
    console.log('Test 7: Song with simple chords');
    const simpleUgData = {
      tab: { song_name: '10,000 Reasons', artist_name: 'Matt Redman' },
      tab_view: {
        meta: { tonality: 'G', capo: 0, bpm: 73 },
        wiki_tab: {
          content: `[Chorus]
[ch]C[/ch]        [ch]G[/ch]         [ch]D[/ch]       [ch]Em[/ch]
Bless the Lord O my soul O my soul
[ch]C[/ch]             [ch]G[/ch]     [ch]D[/ch]
Worship His holy name`,
        },
      },
    };
    const parsedSimple = provider.parseSong(simpleUgData, validUrl);
    assert.strictEqual(parsedSimple.title, '10,000 Reasons');
    assert.strictEqual(parsedSimple.artist, 'Matt Redman');
    assert.strictEqual(parsedSimple.key, 'G');
    assert.strictEqual(parsedSimple.sections.length, 1);
    assert.strictEqual(parsedSimple.sections[0].name, 'Chorus');
    assert.strictEqual(parsedSimple.sections[0].lines.length, 2);

    // -------------------------------------------------------------
    // Test 8: Song with chords embedded at different positions
    // -------------------------------------------------------------
    console.log('Test 8: Song with chords embedded at different positions');
    const line0 = parsedSimple.sections[0].lines[0];
    assert.strictEqual(line0.text, 'Bless the Lord O my soul O my soul');
    assert.strictEqual(line0.chords.length, 4);
    assert.strictEqual(line0.chords[0].chord, 'C');
    assert.strictEqual(line0.chords[0].position, 0); // Above 'Bless'
    assert.strictEqual(line0.chords[1].chord, 'G');
    assert.strictEqual(line0.chords[1].position, 9); // Above 'Lord'
    assert.strictEqual(line0.chords[2].chord, 'D');
    assert.strictEqual(line0.chords[3].chord, 'Em');

    // -------------------------------------------------------------
    // Test 9: Section headings & [tab] stripping
    // -------------------------------------------------------------
    console.log('Test 9: Section headings & [tab] stripping');
    const multiSectionContent = `
[Prelude]
[tab][ch]D[/ch] [ch]D[/ch] [ch]C[/ch] [ch]G[/ch][/tab]

[Pallavi]
[tab][ch]D[/ch]                       [ch]F#m[/ch][/tab]
[tab]Neetipainaa Nadichenu - Gaali samudramunu gaddinchenu[/tab]
[tab][ch]G[/ch]                       [ch]A[/ch][/tab]
[tab]Mrityunjayudai lechenu - Naatho nithyamu Jeevinchunu[/tab]

[Chorus]
[ch]C[/ch]
My chains are gone
[Bridge]
[ch]Em[/ch]
The Lord has promised good to me
[Outro]
[ch]G[/ch]
`;
    const { sections, chordsContent } = UltimateGuitarParser.parseContent(multiSectionContent);
    assert.strictEqual(chordsContent.includes('[tab]'), false, 'Chords content must not contain [tab]');
    assert.strictEqual(chordsContent.includes('[/tab]'), false, 'Chords content must not contain [/tab]');
    assert.strictEqual(sections.length, 5);
    assert.strictEqual(sections[0].name, 'Prelude');
    assert.strictEqual(sections[1].name, 'Pallavi');
    assert.strictEqual(sections[1].lines[0].text, 'Neetipainaa Nadichenu - Gaali samudramunu gaddinchenu');
    assert.strictEqual(sections[1].lines[0].chords[0].chord, 'D');
    assert.strictEqual(sections[1].lines[0].chords[0].position, 0);
    assert.strictEqual(sections[2].name, 'Chorus');
    assert.strictEqual(sections[3].name, 'Bridge');
    assert.strictEqual(sections[4].name, 'Outro');

    // -------------------------------------------------------------
    // Test 10: Empty lines
    // -------------------------------------------------------------
    console.log('Test 10: Empty lines');
    const withEmptyLines = `\n\n[Verse 1]\n\n[ch]G[/ch]\nLine 1\n\n\nLine 2\n\n`;
    const emptyResult = UltimateGuitarParser.parseContent(withEmptyLines);
    assert.strictEqual(emptyResult.sections.length, 1);
    assert.strictEqual(emptyResult.sections[0].lines.length, 2);

    // -------------------------------------------------------------
    // Test 11: Chord-only lines (e.g. Intro / Instrumental)
    // -------------------------------------------------------------
    console.log('Test 11: Chord-only lines');
    const chordOnlyContent = `
[Intro]
[ch]G[/ch]   [ch]C[/ch]   [ch]Em[/ch]   [ch]D[/ch]
`;
    const chordOnlyResult = UltimateGuitarParser.parseContent(chordOnlyContent);
    assert.strictEqual(chordOnlyResult.sections.length, 1);
    assert.strictEqual(chordOnlyResult.sections[0].lines[0].text, '');
    assert.strictEqual(chordOnlyResult.sections[0].lines[0].chords.length, 4);

    // -------------------------------------------------------------
    // Test 12: Lyric-only lines
    // -------------------------------------------------------------
    console.log('Test 12: Lyric-only lines');
    const lyricOnlyContent = `
[Verse 2]
Through many dangers toils and snares
I have already come
`;
    const lyricOnlyResult = UltimateGuitarParser.parseContent(lyricOnlyContent);
    assert.strictEqual(lyricOnlyResult.sections.length, 1);
    assert.strictEqual(lyricOnlyResult.sections[0].lines.length, 2);
    assert.strictEqual(lyricOnlyResult.sections[0].lines[0].chords.length, 0);
    assert.strictEqual(lyricOnlyResult.sections[0].lines[1].chords.length, 0);

    // -------------------------------------------------------------
    // Test 13: Malformed imported content
    // -------------------------------------------------------------
    console.log('Test 13: Malformed imported content');
    assert.throws(
      () => provider.parseSong('<html><body>No data here</body></html>', validUrl),
      (err) => err.statusCode === 422,
      'Should fail gracefully on empty/unparseable HTML'
    );

    // -------------------------------------------------------------
    // Test 14: Duplicate song detection
    // -------------------------------------------------------------
    console.log('Test 14: Duplicate song detection');
    await Song.create({
      churchId: testChurch._id,
      title: 'Way Maker',
      artist: 'Sinach',
      key: 'E',
      source: {
        type: 'external',
        provider: 'ultimate_guitar',
        url: 'https://tabs.ultimate-guitar.com/tab/sinach/way-maker-chords-99999',
      },
    });

    const mockFetcherDuplicate = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        store: {
          page: {
            data: {
              tab: { song_name: 'Way Maker', artist_name: 'Sinach' },
              tab_view: { wiki_tab: { content: '[Chorus]\n[ch]E[/ch]\nWay maker' } },
            },
          },
        },
      }),
    });

    const dupResult = await service.importSong({
      url: 'https://tabs.ultimate-guitar.com/tab/sinach/way-maker-chords-99999',
      churchId: testChurch._id,
      options: { fetcher: mockFetcherDuplicate },
    });

    assert.strictEqual(dupResult.isDuplicate, true, 'Should detect duplicate song by URL and title/artist');
    assert.strictEqual(dupResult.existingSong.title, 'Way Maker');

    // -------------------------------------------------------------
    // Test 15: External request timeout
    // -------------------------------------------------------------
    console.log('Test 15: External request timeout');
    const mockTimeoutFetcher = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    };
    await assert.rejects(
      async () => provider.fetchSong(validUrl, { fetcher: mockTimeoutFetcher }),
      (err) => err.statusCode === 504 && err.message.includes('timed out'),
      'Should return 504 on timeout'
    );

    // -------------------------------------------------------------
    // Test 16: External 403 (Cloudflare / verification)
    // -------------------------------------------------------------
    console.log('Test 16: External 403');
    const mock403Fetcher = async () => ({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });
    await assert.rejects(
      async () => provider.fetchSong(validUrl, { fetcher: mock403Fetcher }),
      (err) => err.statusCode === 502 && err.message.includes('verification'),
      'Should return 502 with friendly manual paste recommendation on 403'
    );

    // -------------------------------------------------------------
    // Test 17: External 429 (Rate limit)
    // -------------------------------------------------------------
    console.log('Test 17: External 429');
    const mock429Fetcher = async () => ({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    });
    await assert.rejects(
      async () => provider.fetchSong(validUrl, { fetcher: mock429Fetcher }),
      (err) => err.statusCode === 429 && err.message.includes('rate limit'),
      'Should return 429 on external rate limiting'
    );

    // -------------------------------------------------------------
    // Test 18: External 5xx
    // -------------------------------------------------------------
    console.log('Test 18: External 5xx');
    const mock500Fetcher = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    await assert.rejects(
      async () => provider.fetchSong(validUrl, { fetcher: mock500Fetcher }),
      (err) => err.statusCode === 502,
      'Should return 502 on external 500'
    );

    // -------------------------------------------------------------
    // Test 19: TV Mode rendering compatibility
    // -------------------------------------------------------------
    console.log('Test 19: TV Mode rendering compatibility');
    // Verify that the imported song's content.chords parses into 2-line chunks with anchored chords
    const tvSections = parseSongToLiveSections(parsedSimple.content.chords, 'G', 'G');
    assert.strictEqual(tvSections.length, 1, 'TV parser must generate valid sections');
    assert.strictEqual(tvSections[0].chunks.length, 1, 'TV parser must generate 2-line slide chunk');
    assert.strictEqual(tvSections[0].chunks[0].lines.length, 2);
    assert.strictEqual(tvSections[0].chunks[0].lines[0].text, 'Bless the Lord O my soul O my soul');
    assert.strictEqual(tvSections[0].chunks[0].lines[0].chords.length, 4);

    // -------------------------------------------------------------
    // Test 20: Editing imported chord positions
    // -------------------------------------------------------------
    console.log('Test 20: Editing imported chord positions');
    const modifiedChords = `[Chorus]\nD        A         E       F#m\nBless the Lord O my soul O my soul`;
    const editedSections = parseSongToLiveSections(modifiedChords, 'D', 'D');
    assert.strictEqual(editedSections[0].chunks[0].lines[0].chords[0].chord, 'D');
    assert.strictEqual(editedSections[0].chunks[0].lines[0].chords[1].chord, 'A');

    // -------------------------------------------------------------
    // Test 21: Saving imported song to MongoDB
    // -------------------------------------------------------------
    console.log('Test 21: Saving imported song');
    const savedSong = await Song.create({
      churchId: testChurch._id,
      title: parsedSimple.title,
      artist: parsedSimple.artist,
      key: parsedSimple.key,
      bpm: parsedSimple.bpm,
      timeSignature: parsedSimple.timeSignature,
      capo: parsedSimple.capo,
      tuning: parsedSimple.tuning,
      source: parsedSimple.source,
      content: parsedSimple.content,
    });
    assert.ok(savedSong._id, 'Song must receive Mongo ObjectId');
    assert.strictEqual(savedSong.source.provider, 'ultimate_guitar');
    assert.strictEqual(savedSong.source.type, 'external');
    assert.strictEqual(savedSong.source.url, validUrl);

    // -------------------------------------------------------------
    // Test 22: Reloading imported song from database
    // -------------------------------------------------------------
    console.log('Test 22: Reloading imported song from database');
    const fetched = await Song.findById(savedSong._id).lean();
    assert.strictEqual(fetched.title, '10,000 Reasons');
    assert.strictEqual(fetched.artist, 'Matt Redman');
    assert.strictEqual(fetched.key, 'G');
    assert.strictEqual(fetched.source.provider, 'ultimate_guitar');

    // Re-verify TV mode on the reloaded DB song
    const reloadedTvSections = parseSongToLiveSections(fetched.content.chords, fetched.key, fetched.key);
    assert.strictEqual(reloadedTvSections.length, 1);
    assert.strictEqual(reloadedTvSections[0].chunks[0].lines[0].chords[0].chord, 'C');

    // -------------------------------------------------------------
    // Test 23: Search with valid query & Chords-only filtering
    // -------------------------------------------------------------
    console.log('Test 23: Search with valid query & Chords filtering');
    const mockSearchResultsHtml = `
      <html>
        <body>
          <div class="js-store" data-content="${JSON.stringify({
            store: {
              page: {
                data: {
                  results: [
                    {
                      id: 2423013,
                      song_name: 'Goodness Of God',
                      artist_name: 'Bethel Music',
                      type: 'Chords',
                      rating: 4.90157,
                      votes: 5734,
                      version: 1,
                      tonality_name: 'G',
                      capo: 0,
                      tab_url: 'https://tabs.ultimate-guitar.com/tab/bethel-music/goodness-of-god-chords-2423013',
                    },
                    {
                      id: 9999991,
                      song_name: 'Goodness Of God',
                      artist_name: 'Bethel Music',
                      type: 'Bass',
                      rating: 4.5,
                      votes: 20,
                      tab_url: 'https://tabs.ultimate-guitar.com/tab/bethel-music/goodness-of-god-bass-9999991',
                    },
                    {
                      id: 3000002,
                      song_name: 'Way Maker',
                      artist_name: 'Sinach',
                      type: 'Chords',
                      rating: 4.88,
                      votes: 2100,
                      version: 2,
                      tonality_name: 'E',
                      capo: 2,
                      tab_url: 'https://tabs.ultimate-guitar.com/tab/sinach/way-maker-chords-3000002',
                    },
                  ],
                },
              },
            },
          }).replace(/"/g, '&quot;')}"></div>
        </body>
      </html>
    `;

    const mockSearchFetcher = async () => ({
      ok: true,
      status: 200,
      text: async () => mockSearchResultsHtml,
    });

    const searchResults = await provider.search('Goodness of God', { fetcher: mockSearchFetcher });
    assert.strictEqual(searchResults.length, 2, 'Must filter out non-Chords results (Bass was excluded)');
    assert.strictEqual(searchResults[0].title, 'Goodness Of God');
    assert.strictEqual(searchResults[0].artist, 'Bethel Music');
    assert.strictEqual(searchResults[0].rating, 4.9);
    assert.strictEqual(searchResults[0].tonality, 'G');
    assert.strictEqual(searchResults[0].type, 'Chords');

    // -------------------------------------------------------------
    // Test 24: Search validation (empty, too short, too long)
    // -------------------------------------------------------------
    console.log('Test 24: Search validation');
    await assert.rejects(
      async () => provider.search(''),
      (err) => err.statusCode === 400 && err.message.includes('required')
    );
    await assert.rejects(
      async () => provider.search('a'),
      (err) => err.statusCode === 400 && err.message.includes('at least 2 characters')
    );
    await assert.rejects(
      async () => provider.search('x'.repeat(105)),
      (err) => err.statusCode === 400 && err.message.includes('cannot exceed 100 characters')
    );

    // -------------------------------------------------------------
    // Test 25: Search duplicate cross-referencing with church library
    // -------------------------------------------------------------
    console.log('Test 25: Search duplicate detection in church library');
    const serviceSearch = await defaultSongImportService.searchSongs({
      query: 'Goodness of God',
      churchId: testChurch._id,
      options: { fetcher: mockSearchFetcher },
    });
    assert.strictEqual(serviceSearch.success, true);
    assert.strictEqual(serviceSearch.results.length, 2);

    // Create "Way Maker" in the library to test duplicate flag
    const wayMakerInDb = await Song.create({
      churchId: testChurch._id,
      title: 'Way Maker',
      artist: 'Sinach',
      key: 'E',
      source: {
        type: 'external',
        provider: 'ultimate_guitar',
        url: 'https://tabs.ultimate-guitar.com/tab/sinach/way-maker-chords-3000002',
      },
      content: { chords: 'E B C#m A\nWay Maker Miracle Worker', lyrics: 'Way Maker Miracle Worker' },
    });

    const duplicateCheckSearch = await defaultSongImportService.searchSongs({
      query: 'Way Maker',
      churchId: testChurch._id,
      options: { fetcher: mockSearchFetcher },
    });
    const wayMakerResult = duplicateCheckSearch.results.find((r) => r.id === '3000002');
    assert.ok(wayMakerResult, 'Way Maker must be present in search results');
    assert.strictEqual(wayMakerResult.inLibrary, true, 'Must flag inLibrary as true');
    assert.strictEqual(String(wayMakerResult.existingSongId), String(wayMakerInDb._id));

    // -------------------------------------------------------------
    // Test 26: Search timeout & rate limit error handling
    // -------------------------------------------------------------
    console.log('Test 26: Search error handling');
    await assert.rejects(
      async () => provider.search('Goodness', { fetcher: mockTimeoutFetcher }),
      (err) => err.statusCode === 504 && err.message.includes('timed out')
    );
    await assert.rejects(
      async () => provider.search('Goodness', { fetcher: mock429Fetcher }),
      (err) => err.statusCode === 429 && err.message.includes('rate limit')
    );

    // -------------------------------------------------------------
    // Test 28: Typo similarity calculation
    // -------------------------------------------------------------
    console.log('Test 28: Typo similarity calculation');
    const { calculateTypoSimilarity } = require('../services/songImport/SongImportService');
    assert.ok(calculateTypoSimilarity('goddness of god', 'Goodness of God') >= 0.85);
    assert.ok(calculateTypoSimilarity('Amezing Grace', 'Amazing Grace') >= 0.85);
    assert.ok(calculateTypoSimilarity('10000 resons', '10000 Reasons') >= 0.85);
    assert.ok(calculateTypoSimilarity('reckles love', 'Reckless Love') >= 0.85);

    // -------------------------------------------------------------
    // Test 29: Auto-import top Ultimate Guitar sheet with typo tolerance
    // -------------------------------------------------------------
    console.log('Test 29: Auto-import top Ultimate Guitar sheet with typo tolerance');
    const autoImportSearchFetcher = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          store: {
            page: {
              data: {
                results: [
                  {
                    id: 4000001,
                    song_name: 'Goodness Of God',
                    artist_name: 'Bethel Music',
                    type_name: 'Chords',
                    tab_url: 'https://tabs.ultimate-guitar.com/tab/bethel-music/goodness-of-god-chords-4000001',
                    rating: 4.9,
                    votes: 5700,
                  },
                  {
                    id: 4000002,
                    song_name: 'Other Song',
                    artist_name: 'Other Artist',
                    type_name: 'Chords',
                    tab_url: 'https://tabs.ultimate-guitar.com/tab/other/other-chords-4000002',
                    rating: 3.5,
                    votes: 10,
                  },
                ],
              },
            },
          },
        }),
    });

    const autoImportTabFetcher = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          store: {
            page: {
              data: {
                tab: { song_name: 'Goodness Of God', artist_name: 'Bethel Music' },
                tab_view: {
                  meta: { tonality: 'G', capo: 0, bpm: 68 },
                  wiki_tab: {
                    content:
                      '[Verse 1]\n[ch]G[/ch]\nI love you Lord\n           [ch]C[/ch]          [ch]G[/ch]\nFor your mercy never fails me',
                  },
                },
              },
            },
          },
        }),
    });

    const bestMatch = await defaultSongImportService.findBestMatch('goddness of god', {
      fetcher: autoImportSearchFetcher,
    });
    assert.ok(bestMatch, 'Must find best match for typo query "goddness of god"');
    assert.strictEqual(bestMatch.title, 'Goodness Of God');
    assert.strictEqual(bestMatch.artist, 'Bethel Music');

    const autoImportRes = await defaultSongImportService.autoImportBestMatch({
      query: 'goddness of god',
      churchId: testChurch._id,
      options: {
        searchFetcher: autoImportSearchFetcher,
        tabFetcher: autoImportTabFetcher,
      },
    });
    assert.strictEqual(autoImportRes.imported, true);
    assert.strictEqual(autoImportRes.song.title, 'Goodness Of God');
    assert.strictEqual(autoImportRes.song.artist, 'Bethel Music');
    assert.strictEqual(autoImportRes.song.key, 'G');
    assert.ok(autoImportRes.song.content?.chords.includes('I love you Lord'));

    // -------------------------------------------------------------
    // Test 30: Transpose raw chords text from one key to another
    // -------------------------------------------------------------
    console.log('Test 30: Transpose raw chords text from one key to another');
    const { transposeChordsText } = require('../utils/songParser');
    const originalChordsG = '[Verse 1]\nG\nI love you Lord\n           C          G\nFor your mercy never fails me\nD/F#   Em              C          D\nAll my days';
    const transposedToD = transposeChordsText(originalChordsG, 'G', 'D');
    assert.ok(transposedToD.includes('D'), 'Root G should transpose to D');
    assert.ok(transposedToD.includes('G'), 'C should transpose to G');
    assert.ok(transposedToD.includes('A/C#'), 'D/F# should transpose to A/C#');
    assert.ok(transposedToD.includes('Bm'), 'Em should transpose to Bm');

    // -------------------------------------------------------------
    // Test 31: Update song key transposes content.chords in database
    // -------------------------------------------------------------
    console.log('Test 31: Update song key transposes content.chords in database');
    const songToTranspose = await Song.create({
      churchId: testChurch._id,
      title: 'Key Transpose Test Song',
      key: 'G',
      content: { chords: originalChordsG, lyrics: 'I love you Lord' },
    });

    const songController = require('../controllers/songController');
    const mockReq = {
      user: { churchId: testChurch._id },
      params: { id: String(songToTranspose._id) },
      body: { key: 'D' },
    };
    let jsonResult = null;
    const mockRes = {
      json: (data) => {
        jsonResult = data;
      },
      status: () => mockRes,
    };

    await songController.updateSong(mockReq, mockRes);
    assert.ok(jsonResult, 'Must return updated song');
    assert.strictEqual(jsonResult.key, 'D');
    assert.ok(jsonResult.content?.chords.includes('A/C#'), 'Chords in DB must be transposed to Key D');

    // -------------------------------------------------------------
    // Test 32: Quick add song imports in original key and converts to selected key
    // -------------------------------------------------------------
    console.log('Test 32: Quick add song imports in original key and converts to selected key');
    const autoImportSearchFetcher32 = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          store: {
            page: {
              data: {
                results: [
                  {
                    id: 5000001,
                    song_name: 'Goodness Of God',
                    artist_name: 'Bethel Music',
                    type_name: 'Chords',
                    tab_url: 'https://tabs.ultimate-guitar.com/tab/bethel-music/goodness-of-god-chords-5000001',
                    rating: 4.9,
                    votes: 6000,
                  },
                ],
              },
            },
          },
        }),
    });

    const autoImportTabFetcher32 = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          store: {
            page: {
              data: {
                tab: { song_name: 'Goodness Of God', artist_name: 'Bethel Music' },
                tab_view: {
                  meta: { tonality: 'G', capo: 0, bpm: 68 },
                  wiki_tab: {
                    content:
                      '[Verse 1]\nG\nI love you Lord\n           C          G\nFor your mercy never fails me\nD/F#   Em              C          D\nAll my days',
                  },
                },
              },
            },
          },
        }),
    });

    // Mock search and import on defaultSongImportService
    const origSearch = defaultSongImportService.searchSongs;
    const origImport = defaultSongImportService.importSong;

    defaultSongImportService.searchSongs = async (args) =>
      origSearch.call(defaultSongImportService, {
        ...args,
        options: { fetcher: autoImportSearchFetcher32 },
      });

    defaultSongImportService.importSong = async (args) =>
      origImport.call(defaultSongImportService, {
        ...args,
        options: { fetcher: autoImportTabFetcher32 },
      });

    // Test with user selecting Key 'D' when original is 'G'
    const createReqWithKeyD = {
      user: { churchId: testChurch._id },
      body: {
        title: 'Goodness of God (Transposed Quick Add)',
        key: 'D',
        autoImport: true,
      },
    };
    let createdWithKeyD = null;
    const createResWithKeyD = {
      json: (data) => {
        createdWithKeyD = data;
      },
      status: () => createResWithKeyD,
    };

    await songController.createSong(createReqWithKeyD, createResWithKeyD);
    assert.ok(createdWithKeyD, 'Must create song');
    assert.strictEqual(createdWithKeyD.key, 'D', 'Song key must be user-selected key D');
    assert.ok(createdWithKeyD.content?.chords.includes('A/C#'), 'Chords must be converted to Key D');

    // -------------------------------------------------------------
    // Test 33: Quick add song imports and preserves original key when AUTO
    // -------------------------------------------------------------
    console.log('Test 33: Quick add song imports and preserves original key when AUTO');
    const createReqWithAutoKey = {
      user: { churchId: testChurch._id },
      body: {
        title: 'Goodness of God (Original Key Quick Add)',
        key: 'AUTO',
        autoImport: true,
      },
    };
    let createdWithAuto = null;
    const createResWithAuto = {
      json: (data) => {
        createdWithAuto = data;
      },
      status: () => createResWithAuto,
    };

    await songController.createSong(createReqWithAutoKey, createResWithAuto);
    assert.ok(createdWithAuto, 'Must create song');
    assert.strictEqual(createdWithAuto.key, 'G', 'Song key must be original imported key G');
    assert.ok(createdWithAuto.content?.chords.includes('D/F#'), 'Chords must be in original Key G');

    // Restore service mocks
    defaultSongImportService.searchSongs = origSearch;
    defaultSongImportService.importSong = origImport;

    console.log('\nAll 33 Ultimate Guitar Song Import, Auto-Import & Key Transposition test cases passed successfully!');
  } finally {
    await Church.deleteMany({});
    await Song.deleteMany({});
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runImportTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
