import { describe, expect, test } from 'bun:test';
import { NO_ROUTES, canToggleSpeaker, joinedHeadset, parseAudioRoutes, speakerOn, speakerTarget, type AudioRoutes } from '../lib/calls.route.core';

function routes(available: AudioRoutes['available'], selected: AudioRoutes['selected']): AudioRoutes {
  return { available, selected };
}

describe('call audio routes', () => {
  test('reads the native route status in a fixed order', () => {
    expect(parseAudioRoutes({ availableAudioDeviceList: '["SPEAKER_PHONE","EARPIECE","BLUETOOTH"]', selectedAudioDevice: 'EARPIECE' }))
      .toEqual(routes(['BLUETOOTH', 'EARPIECE', 'SPEAKER_PHONE'], 'EARPIECE'));
    expect(parseAudioRoutes({ availableAudioDeviceList: '[]', selectedAudioDevice: '' })).toEqual(NO_ROUTES);
    expect(parseAudioRoutes({ availableAudioDeviceList: '["CAR","SPEAKER_PHONE"]', selectedAudioDevice: 'CAR' })).toEqual(routes(['SPEAKER_PHONE'], null));
    expect(parseAudioRoutes(null)).toEqual(NO_ROUTES);
  });

  test('a voice call on the earpiece switches to the speaker and back', () => {
    const earpiece = routes(['EARPIECE', 'SPEAKER_PHONE'], 'EARPIECE');
    expect(speakerOn(earpiece)).toBe(false);
    expect(speakerTarget(earpiece)).toBe('SPEAKER_PHONE');
    expect(speakerTarget({ ...earpiece, selected: 'SPEAKER_PHONE' })).toBe('EARPIECE');
  });

  test('with a headset the speaker switches back to the headset, Bluetooth first', () => {
    expect(speakerTarget(routes(['WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'], 'SPEAKER_PHONE'))).toBe('WIRED_HEADSET');
    expect(speakerTarget(routes(['BLUETOOTH', 'WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'], 'SPEAKER_PHONE'))).toBe('BLUETOOTH');
    expect(speakerTarget(routes(['BLUETOOTH', 'EARPIECE', 'SPEAKER_PHONE'], 'BLUETOOTH'))).toBe('SPEAKER_PHONE');
  });

  test('hides the toggle when the speaker is the only route', () => {
    expect(canToggleSpeaker(NO_ROUTES)).toBe(false);
    expect(canToggleSpeaker(routes(['SPEAKER_PHONE'], 'SPEAKER_PHONE'))).toBe(false);
    expect(speakerTarget(routes(['SPEAKER_PHONE'], 'SPEAKER_PHONE'))).toBeNull();
    expect(canToggleSpeaker(routes(['EARPIECE', 'SPEAKER_PHONE'], 'SPEAKER_PHONE'))).toBe(true);
  });

  test('moves to a headset plugged in during the call', () => {
    const speaker = routes(['EARPIECE', 'SPEAKER_PHONE'], 'SPEAKER_PHONE');
    expect(joinedHeadset(speaker, routes(['WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'], 'SPEAKER_PHONE'))).toBe('WIRED_HEADSET');
    expect(joinedHeadset(speaker, routes(['BLUETOOTH', 'EARPIECE', 'SPEAKER_PHONE'], 'EARPIECE'))).toBe('BLUETOOTH');
    expect(joinedHeadset(speaker, routes(['WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'], 'WIRED_HEADSET'))).toBeNull();
    expect(joinedHeadset(routes(['WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'], 'WIRED_HEADSET'), speaker)).toBeNull();
    expect(joinedHeadset(NO_ROUTES, routes(['WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'], 'WIRED_HEADSET'))).toBeNull();
  });
});
