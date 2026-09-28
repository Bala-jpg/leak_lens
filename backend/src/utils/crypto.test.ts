import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeviceKey, hashDeviceKey, hashPassword, verifyPassword } from './crypto';

test('device credentials are unique and only their keyed digest is stored', () => {
  const first = generateDeviceKey();
  const second = generateDeviceKey();
  assert.notEqual(first, second);
  assert.equal(hashDeviceKey(first), hashDeviceKey(first));
  assert.notEqual(hashDeviceKey(first), hashDeviceKey(second));
  assert.equal(hashDeviceKey(first).length, 64);
  assert.ok(!hashDeviceKey(first).includes(first));
});

test('password hash accepts only the original password', async () => {
  const digest = await hashPassword('correct-password');
  assert.equal(await verifyPassword('correct-password', digest), true);
  assert.equal(await verifyPassword('wrong-password', digest), false);
});
