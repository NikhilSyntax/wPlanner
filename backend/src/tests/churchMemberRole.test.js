const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const churchController = require('../controllers/churchController');

async function runTests() {
  console.log('--- Starting Church Member Role & Permissions Management Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'ROLE01';
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({
    email: {
      $in: [
        'rolemember1@test.com',
        'rolemember2@test.com',
        'roleadmin1@test.com',
        'roleadmin2@test.com',
      ],
    },
  });

  const creatorAdmin = new User({
    name: 'Creator Admin',
    email: 'roleadmin1@test.com',
    password: 'password123',
    role: 'Admin',
    isAdmin: true,
    isSubAdmin: false,
    approvalStatus: 'approved',
  });

  const church = await Church.create({
    name: 'Role Test Church',
    churchCode: testCode,
    createdBy: creatorAdmin._id,
  });

  creatorAdmin.churchId = church._id;
  await creatorAdmin.save();

  const secondAdmin = await User.create({
    name: 'Second Admin',
    email: 'roleadmin2@test.com',
    password: 'password123',
    role: 'Admin',
    isAdmin: true,
    isSubAdmin: false,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const member1 = await User.create({
    name: 'Worship Member',
    email: 'rolemember1@test.com',
    password: 'password123',
    role: 'Singer',
    isAdmin: false,
    isSubAdmin: false,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const member2 = await User.create({
    name: 'General Member',
    email: 'rolemember2@test.com',
    password: 'password123',
    role: 'Member',
    isAdmin: false,
    isSubAdmin: false,
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

  // TEST 1: Admin changes member1 role from "Singer" to "Worship Leader"
  console.log('Test 1: Admin changes member role to Worship Leader...');
  const mock1 = mockReqRes({
    user: { userId: creatorAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: member1._id.toString() },
    body: { role: 'Worship Leader', adminRole: 'member' },
  });
  await churchController.updateMemberRole(mock1.req, mock1.res);
  const res1 = mock1.getResult();
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.user.role, 'Worship Leader');
  assert.strictEqual(res1.data.user.isAdmin, false);
  assert.strictEqual(res1.data.user.isSubAdmin, false);

  const dbMember1 = await User.findById(member1._id).lean();
  assert.strictEqual(dbMember1.role, 'Worship Leader');
  console.log('✅ Test 1 Passed: Role changed to Worship Leader.');

  // TEST 2: Admin promotes member1 to Sub-Admin
  console.log('Test 2: Admin promotes member to Sub-Admin with role Guitarist...');
  const mock2 = mockReqRes({
    user: { userId: creatorAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: member1._id.toString() },
    body: { role: 'Guitarist', adminRole: 'sub-admin' },
  });
  await churchController.updateMemberRole(mock2.req, mock2.res);
  const res2 = mock2.getResult();
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.data.user.role, 'Guitarist');
  assert.strictEqual(res2.data.user.isAdmin, false);
  assert.strictEqual(res2.data.user.isSubAdmin, true);

  const dbMember1Sub = await User.findById(member1._id).lean();
  assert.strictEqual(dbMember1Sub.isSubAdmin, true);
  assert.strictEqual(dbMember1Sub.isAdmin, false);
  console.log('✅ Test 2 Passed: Member promoted to Sub-Admin.');

  // TEST 3: Admin promotes member2 to full Admin by setting role "Admin"
  console.log('Test 3: Admin sets member2 role to "Admin"...');
  const mock3 = mockReqRes({
    user: { userId: creatorAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: member2._id.toString() },
    body: { role: 'Admin', adminRole: 'admin' },
  });
  await churchController.updateMemberRole(mock3.req, mock3.res);
  const res3 = mock3.getResult();
  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.data.user.role, 'Admin');
  assert.strictEqual(res3.data.user.isAdmin, true);
  assert.strictEqual(res3.data.user.isSubAdmin, false);

  const dbMember2 = await User.findById(member2._id).lean();
  assert.strictEqual(dbMember2.isAdmin, true);
  console.log('✅ Test 3 Passed: Member promoted to Full Admin.');

  // TEST 4: Invalid role rejected with 400
  console.log('Test 4: Invalid role rejected...');
  const mock4 = mockReqRes({
    user: { userId: creatorAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: member1._id.toString() },
    body: { role: 'InvalidRole123' },
  });
  await churchController.updateMemberRole(mock4.req, mock4.res);
  const res4 = mock4.getResult();
  assert.strictEqual(res4.status, 400);
  console.log('✅ Test 4 Passed: Invalid role rejected with 400.');

  // TEST 5: Second admin cannot demote Church Creator
  console.log('Test 5: Demoting creator forbidden...');
  const mock5 = mockReqRes({
    user: { userId: secondAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: creatorAdmin._id.toString() },
    body: { role: 'Member', adminRole: 'member' },
  });
  await churchController.updateMemberRole(mock5.req, mock5.res);
  const res5 = mock5.getResult();
  assert.strictEqual(res5.status, 403);
  console.log('✅ Test 5 Passed: Demoting creator blocked with 403.');

  // TEST 6: Non-creator admin cannot demote another full admin
  console.log('Test 6: Non-creator admin cannot demote another full admin...');
  const mock6 = mockReqRes({
    user: { userId: secondAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: member2._id.toString() }, // member2 was made admin in Test 3
    body: { role: 'Member', adminRole: 'member' },
  });
  await churchController.updateMemberRole(mock6.req, mock6.res);
  const res6 = mock6.getResult();
  assert.strictEqual(res6.status, 403);
  console.log('✅ Test 6 Passed: Non-creator cannot demote another admin.');

  // TEST 7: Creator CAN demote another admin
  console.log('Test 7: Creator can demote another admin...');
  const mock7 = mockReqRes({
    user: { userId: creatorAdmin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { userId: member2._id.toString() },
    body: { role: 'Production', adminRole: 'member' },
  });
  await churchController.updateMemberRole(mock7.req, mock7.res);
  const res7 = mock7.getResult();
  assert.strictEqual(res7.status, 200);
  assert.strictEqual(res7.data.user.role, 'Production');
  assert.strictEqual(res7.data.user.isAdmin, false);
  console.log('✅ Test 7 Passed: Creator demoted admin back to regular member.');

  // Cleanup
  await User.deleteMany({
    _id: { $in: [creatorAdmin._id, secondAdmin._id, member1._id, member2._id] },
  });
  await Church.deleteMany({ _id: church._id });

  await mongoose.disconnect();
  console.log('All Church Member Role Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Church member role test failure:', err);
  process.exit(1);
});
