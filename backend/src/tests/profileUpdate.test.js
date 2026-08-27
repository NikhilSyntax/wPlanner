const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const userController = require('../controllers/userController');

async function runTests() {
  console.log('--- Starting Profile Update (Instrument & Role) Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'PROF01';
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({ email: { $in: ['profvolunteer@test.com', 'profadmin@test.com'] } });

  const church = await Church.create({ name: 'Profile Test Church', churchCode: testCode });

  const volunteer = await User.create({
    name: 'Volunteer Veronica',
    email: 'profvolunteer@test.com',
    password: 'password',
    role: 'Singer',
    isAdmin: false,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const admin = await User.create({
    name: 'Admin Alex',
    email: 'profadmin@test.com',
    password: 'password',
    role: 'Admin',
    isAdmin: true,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  function mockReqRes(reqData) {
    let statusCode = 200;
    let responseData = null;
    const req = {
      user: reqData.user,
      params: reqData.params || {},
      query: reqData.query || {},
      body: reqData.body || {},
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };
    return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
  }

  // TEST 1: Volunteer updates instrument to "Guitarist"
  console.log('Test 1: Member updates instrument to Guitarist...');
  const mock1 = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: church._id.toString(), isAdmin: false },
    body: { role: 'Guitarist' },
  });
  await userController.updateProfile(mock1.req, mock1.res);
  const res1 = mock1.getResult();
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.user.role, 'Guitarist');

  const userInDb = await User.findById(volunteer._id).lean();
  assert.strictEqual(userInDb.role, 'Guitarist');
  console.log('✅ Test 1 Passed: Member instrument successfully updated to Guitarist.');

  // TEST 2: Invalid role rejected
  console.log('Test 2: Invalid role rejected...');
  const mock2 = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: church._id.toString(), isAdmin: false },
    body: { role: 'Astronaut' },
  });
  await userController.updateProfile(mock2.req, mock2.res);
  const res2 = mock2.getResult();
  assert.strictEqual(res2.status, 400);
  console.log('✅ Test 2 Passed: Invalid role properly rejected with 400.');

  // TEST 3: Admin cannot use this endpoint to alter role
  console.log('Test 3: Admin blocked from changing role through member endpoint...');
  const mock3 = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    body: { role: 'Drummer' },
  });
  await userController.updateProfile(mock3.req, mock3.res);
  const res3 = mock3.getResult();
  assert.strictEqual(res3.status, 403);
  console.log('✅ Test 3 Passed: Admin role modification properly blocked with 403.');

  // Cleanup
  await User.deleteMany({ _id: { $in: [volunteer._id, admin._id] } });
  await Church.deleteMany({ _id: church._id });

  await mongoose.disconnect();
  console.log('All Profile Update Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Profile update test failure:', err);
  process.exit(1);
});
