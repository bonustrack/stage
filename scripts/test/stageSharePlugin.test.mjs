import { describe, expect, test } from 'bun:test';
import stageShare from '../../apps/stage/plugins/withStageShare.js';

const capture = 'box.stage.share.StageSharePackage.receive(this, intent)';
const fixture = 'class MainActivity : ReactActivity() {\n  override fun createReactActivityDelegate(): ReactActivityDelegate = delegate\n}';

describe('Android share activity integration', () => {
  test('captures new intents before the delegate can defer React startup', () => {
    const patched = stageShare.captureNewIntents(fixture);
    expect(patched).toContain('override fun onNewIntent(intent: android.content.Intent)');
    expect(patched.indexOf(capture)).toBeLessThan(patched.indexOf('super.onNewIntent(intent)'));
    expect(patched).toContain('override fun createReactActivityDelegate(): ReactActivityDelegate = delegate');
    expect(stageShare.captureNewIntents(patched)).toBe(patched);
  });

  test('preserves an existing handler and captures before its super call', () => {
    const source = 'class MainActivity {\n  override fun onNewIntent(intent: Intent) {\n    existing(intent)\n    super.onNewIntent(intent)\n  }\n}';
    const patched = stageShare.captureNewIntents(source);
    expect(patched).toContain('existing(intent)');
    expect(patched.indexOf(capture)).toBeLessThan(patched.indexOf('super.onNewIntent(intent)'));
    expect(patched.match(/override fun onNewIntent/g)).toHaveLength(1);
  });

  test('fails closed for unsupported generated activities', () => {
    expect(() => stageShare.captureNewIntents('class MainActivity {}')).toThrow('supported Kotlin MainActivity');
    expect(() => stageShare.captureNewIntents('override fun onNewIntent(intent: Intent) {}')).toThrow('supported MainActivity.onNewIntent');
  });
});
