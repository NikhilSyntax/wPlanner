const assert = require('assert');
const mongoose = require('mongoose');
const Song = require('../models/Song');
const Church = require('../models/Church');
const {
  ChristianLyriczProvider,
  extractSlugFromUrl,
  normalizeLyricsContent,
} = require('../services/songImport/ChristianLyriczProvider');
const { defaultSongImportService, SongImportService } = require('../services/songImport/SongImportService');
const songController = require('../controllers/songController');
const songImportController = require('../controllers/songImportController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wplanner_test_cl';

async function runChristianLyriczTests() {
  console.log('=== Starting ChristianLyricz Telugu Lyrics & Auto-Import Test Suite ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB test database.');

  await Church.deleteMany({});
  await Song.deleteMany({});

  const testChurch = await Church.create({
    name: 'Calvary Telugu Worship Center',
    churchCode: 'TEL001',
    plan: 'enterprise',
  });

  const clProvider = new ChristianLyriczProvider();
  const service = new SongImportService();

  try {
    // -------------------------------------------------------------
    // Test 1: URL Handling and Verification
    // -------------------------------------------------------------
    console.log('Test 1: URL Handling and Validation');
    assert.strictEqual(
      clProvider.canHandle('https://christianlyricz.com/song/anni-kaalambula/'),
      true,
      'Should recognize canonical ChristianLyricz song URL'
    );
    assert.strictEqual(
      clProvider.canHandle('https://christianlyricz.com/2016/01/26/anni-kaalambula/'),
      true,
      'Should recognize dated ChristianLyricz URL'
    );
    assert.strictEqual(
      clProvider.canHandle('https://tabs.ultimate-guitar.com/tab/123'),
      false,
      'Should not claim Ultimate Guitar URL'
    );

    // -------------------------------------------------------------
    // Test 2: Slug Extraction from URLs
    // -------------------------------------------------------------
    console.log('Test 2: Slug Extraction from various URL formats');
    assert.strictEqual(
      extractSlugFromUrl('https://christianlyricz.com/song/anni-kaalambula/'),
      'anni-kaalambula'
    );
    assert.strictEqual(
      extractSlugFromUrl('https://christianlyricz.com/2016/01/26/nede-priyaraagam/'),
      'nede-priyaraagam'
    );
    assert.strictEqual(
      extractSlugFromUrl('https://christianlyricz.com/hosanna-hosanna/'),
      'hosanna-hosanna'
    );

    // -------------------------------------------------------------
    // Test 3: Normalizing Lyrics Content
    // -------------------------------------------------------------
    console.log('Test 3: Normalizing Lyrics Content');
    const arrayLines = ['Line 1', 'Line 2', '', 'Chorus'];
    assert.strictEqual(
      normalizeLyricsContent(arrayLines),
      'Line 1\nLine 2\n\nChorus'
    );
    assert.strictEqual(normalizeLyricsContent('Single line'), 'Single line');
    assert.strictEqual(normalizeLyricsContent(null), '');

    // -------------------------------------------------------------
    // Test 4: Live Search on ChristianLyricz
    // -------------------------------------------------------------
    console.log('Test 4: Live Search on ChristianLyricz for Telugu songs');
    const searchRes = await clProvider.search('Anni Kaalambula', { language: 'telugu' });
    assert.ok(Array.isArray(searchRes), 'Search results should be an array');
    assert.ok(searchRes.length > 0, 'Should find at least one matching song for Anni Kaalambula');
    const firstMatch = searchRes[0];
    assert.strictEqual(firstMatch.provider, 'christian_lyricz');
    assert.strictEqual(firstMatch.language, 'telugu');
    assert.ok(firstMatch.rawTitle, 'Should include Telugu raw title');

    // -------------------------------------------------------------
    // Test 5: Fetch Song and Parse into Normalized Song Model
    // -------------------------------------------------------------
    console.log('Test 5: Fetch Song and Parse into Normalized Model');
    const fetchedDoc = await clProvider.fetchSong('https://christianlyricz.com/song/anni-kaalambula/');
    const parsedSong = clProvider.parseSong(fetchedDoc, 'https://christianlyricz.com/song/anni-kaalambula/');
    assert.ok(parsedSong.title, 'Should have parsed title');
    assert.ok(parsedSong.content.lyrics, 'Should have parsed lyrics');
    assert.ok(Array.isArray(parsedSong.regionalLyrics), 'Should have regionalLyrics array');
    assert.strictEqual(parsedSong.regionalLyrics[0].language, 'Telugu');
    assert.ok(parsedSong.regionalLyrics[0].content.lyrics.includes('అన్ని కాలంబుల'));

    // -------------------------------------------------------------
    // Test 6: Typo-Tolerant Telugu Match for Song Titles
    // -------------------------------------------------------------
    console.log('Test 6: Typo-Tolerant Telugu Match');
    const matchHosanna = await clProvider.findBestTeluguMatch('Hosanna');
    assert.ok(matchHosanna && matchHosanna.found, 'Should find match for Hosanna');
    assert.strictEqual(matchHosanna.language, 'Telugu');
    assert.ok(matchHosanna.lyrics.length > 0, 'Should return non-empty Telugu lyrics');

    const matchNede = await clProvider.findBestTeluguMatch('Nede Priyaraagam');
    assert.ok(matchNede && matchNede.found, 'Should find match for Nede Priyaraagam');
    assert.strictEqual(matchNede.teluguTitle, 'నేడే ప్రియరాగం');

    // -------------------------------------------------------------
    // Test 7: SongImportService Routing
    // -------------------------------------------------------------
    console.log('Test 7: SongImportService URL Routing & Import');
    const importResult = await service.importSong({
      url: 'https://christianlyricz.com/song/anni-kaalambula/',
      churchId: testChurch._id,
    });
    assert.strictEqual(importResult.success, true);
    assert.strictEqual(importResult.song.source.provider, 'christian_lyricz');
    assert.ok(importResult.song.regionalLyrics.length > 0);

    // -------------------------------------------------------------
    // Test 8: Auto-Import Telugu Lyrics on Song Creation
    // -------------------------------------------------------------
    console.log('Test 8: Auto-Import Telugu Lyrics on Song Creation');
    const reqCreate = {
      user: { churchId: testChurch._id },
      body: {
        title: 'Nede Priyaraagam',
        artist: 'Telugu Worship',
        key: 'D',
        autoImport: true,
      },
    };
    let createdSong = null;
    const resCreate = {
      status: (code) => ({
        json: (data) => {
          createdSong = data;
          return data;
        },
      }),
    };
    await songController.createSong(reqCreate, resCreate);
    assert.ok(createdSong, 'Song should be created');
    assert.ok(
      createdSong.regionalLyrics && createdSong.regionalLyrics.length > 0,
      'Song should automatically have regionalLyrics populated with Telugu'
    );
    const teluguEntry = createdSong.regionalLyrics.find((r) => r.language === 'Telugu');
    assert.ok(teluguEntry, 'Should contain Telugu regional lyrics entry');
    assert.ok(teluguEntry.content.lyrics.includes('నేడే ప్రియరాగం'));

    // -------------------------------------------------------------
    // Test 9: Manual Regional Lyrics are NOT overwritten
    // -------------------------------------------------------------
    console.log('Test 9: Existing manual regional lyrics are preserved');
    const reqPreserve = {
      user: { churchId: testChurch._id },
      body: {
        title: 'Custom Song With Telugu',
        artist: 'Pastor Mark',
        key: 'G',
        regionalLyrics: [
          {
            language: 'Telugu',
            name: 'My Custom Telugu',
            content: { lyrics: 'నా సొంత తెలుగు పాట', chords: 'G C D' },
          },
        ],
      },
    };
    let preservedSong = null;
    const resPreserve = {
      status: (code) => ({
        json: (data) => {
          preservedSong = data;
          return data;
        },
      }),
    };
    await songController.createSong(reqPreserve, resPreserve);
    const customEntry = preservedSong.regionalLyrics.find((r) => r.language === 'Telugu');
    assert.strictEqual(customEntry.content.lyrics, 'నా సొంత తెలుగు పాట');

    // -------------------------------------------------------------
    // Test 10: Import Telugu Lyrics for Existing Song (Endpoint)
    // -------------------------------------------------------------
    console.log('Test 10: importTeluguLyrics controller method');
    const freshSong = await Song.create({
      churchId: testChurch._id,
      title: 'Hosanna',
      artist: 'Worship',
      key: 'E',
      content: { chords: 'E B C#m A', lyrics: 'Hosanna in the highest' },
    });

    const reqImportTelugu = {
      user: { churchId: testChurch._id },
      params: { id: freshSong._id },
      body: { query: 'Hosanna' },
    };
    let importResponse = null;
    const resImportTelugu = {
      status: (code) => ({
        json: (data) => {
          importResponse = data;
          return data;
        },
      }),
    };
    await songController.importTeluguLyrics(reqImportTelugu, resImportTelugu);
    assert.ok(importResponse.success);
    assert.ok(importResponse.song.regionalLyrics.some((r) => r.language === 'Telugu'));

    // -------------------------------------------------------------
    // Test 11: searchTeluguLyrics endpoint
    // -------------------------------------------------------------
    console.log('Test 11: searchTeluguLyrics import controller');
    const reqSearch = { query: { q: 'Anni Kaalambula' } };
    let searchOutput = null;
    const resSearch = {
      status: (code) => ({
        json: (data) => {
          searchOutput = data;
          return data;
        },
      }),
    };
    await songImportController.searchTeluguLyrics(reqSearch, resSearch);
    assert.ok(searchOutput && searchOutput.found);
    assert.strictEqual(searchOutput.language, 'Telugu');

    console.log('\nAll ChristianLyricz Telugu Lyrics & Auto-Import test cases passed successfully! 🎉');
  } finally {
    await Church.deleteMany({ _id: testChurch._id });
    await Song.deleteMany({ churchId: testChurch._id });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

if (require.main === module) {
  runChristianLyriczTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}

module.exports = { runChristianLyriczTests };
