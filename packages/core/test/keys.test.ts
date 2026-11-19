import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_LISTS, label, toKey, type KeyList } from '../src/keys';

test('toKey akzeptiert Schlüssel, Label und Altwert und verwirft Unbekanntes', () => {
  const list: KeyList = [{ key: 'navy', label: 'Marineblau' }];
  assert.equal(toKey(list, 'navy'), 'navy');
  assert.equal(toKey(list, 'Marineblau'), 'navy');
  assert.equal(toKey(list, 'marine', { marine: 'navy' }), 'navy');
  assert.equal(toKey(list, 'unbekannt'), null);
  assert.equal(toKey(list, null), null);
  assert.equal(label(list, 'navy'), 'Marineblau');
});

test('Zuordnungsdatei enthält Listen aus Einträgen mit Schlüssel und Label', () => {
  const lists = KEY_LISTS as unknown as Record<string, unknown>;
  for (const [name, values] of Object.entries(lists)) {
    if (name === 'categories') continue;
    assert.ok(Array.isArray(values), `${name} ist eine Liste`);
    for (const value of values as { key?: unknown; label?: unknown }[]) {
      assert.equal(typeof value.key, 'string', `${name} hat key`);
      assert.equal(typeof value.label, 'string', `${name} hat label`);
    }
  }
});
