import { describe, test } from 'bun:test';
import { screenHeader } from '../src/chrome/screenHeader';
import { snap } from './helpers';

describe('screenHeader', () => {
  test('minimal (bar, back only)', () => {
    snap(screenHeader({ backColor: '#111111' }));
  });

  test('full bar with text title', () => {
    snap(
      screenHeader({
        title: 'Details',
        titleStyle: { kind: 'text', size: 'lg', weight: 'semibold', color: '#222222', truncate: true, maxLines: 1 },
        backColor: '#111111',
        backType: 'custom.back',
        backPayload: { from: 'details' },
        backHitSlop: 12,
        backPadding: 6,
        safeTop: 44,
        padTop: 10,
        padBottom: 12,
        surface: '#ffffff',
        borderColor: '#eeeeee',
        trailing: [{ type: 'Icon', name: 'dotsHorizontal', size: 22, color: '#111111' }],
        variant: 'bar',
      }),
    );
  });

  test('full bar with title-kind title and flex', () => {
    snap(
      screenHeader({
        title: 'Wallet',
        titleStyle: { kind: 'title', size: 'sm', weight: 'semibold', color: '#000000', truncate: true, maxLines: 2, flex: true },
        backColor: '#111111',
      }),
    );
  });

  test('bar without titleStyle omits the title node', () => {
    snap(screenHeader({ title: 'Ignored', backColor: '#111111' }));
  });

  test('minimal overlay', () => {
    snap(screenHeader({ backColor: '#ffffff', variant: 'overlay' }));
  });

  test('full overlay', () => {
    snap(
      screenHeader({
        backColor: '#ffffff',
        variant: 'overlay',
        safeTop: 47,
        surface: 'rgba(0,0,0,0.4)',
        borderColor: '#333333',
        fixedHeight: 96,
        zIndex: 5,
        backType: 'custom.back',
        backPayload: { from: 'overlay' },
        trailing: [{ type: 'Icon', name: 'share', size: 20, color: '#ffffff' }],
      }),
    );
  });
});
