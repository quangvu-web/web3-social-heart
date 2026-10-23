import { expect, test } from 'bun:test';
import { clampFabPosition, loadFabPosition, isCaptionGuest, FAB_DRAG_THRESHOLD } from './fabPosition';

test('FAB remains fully within viewport with 8px margins', () => {
  expect(clampFabPosition({ x: -30, y: 900 }, 390, 844)).toEqual({ x: 8, y: 780 });
  expect(clampFabPosition({ x: 1200, y: 1700 }, 1280, 1800)).toEqual({ x: 1200, y: 1700 });
});
test('remembered position restores and clamps after rotation', () => {
  expect(loadFabPosition({ getItem: () => '{"x":800,"y":400}' }, 390, 844)).toEqual({ x: 326, y: 400 });
  expect(loadFabPosition({ getItem: () => 'broken' }, 390, 844)).toBeNull();
});
test('guests are enabled only on caption session routes', () => {
  expect(isCaptionGuest('/captions/test', null)).toBe(true);
  expect(isCaptionGuest('/', null)).toBe(false);
  expect(isCaptionGuest('/captions/test', { id: 'user' })).toBe(false);
  expect(FAB_DRAG_THRESHOLD).toBe(6);
});