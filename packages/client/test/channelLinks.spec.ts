import { describe, expect, test } from 'bun:test';
import { channelLinkLabel, channelLinkText, channelFallbackLabel, markdownLabelText } from '../src/xmtp/channelLinks';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';

describe('channel link names', () => {
  test('known DM conversation links retain their original text instead of a hash label', () => {
    const url = `stage://xmtp/${CONV}`;
    expect(channelLinkText({ peerAddress: '0xabc' }, undefined, url)).toBe(url);
    expect(channelLinkText({ peerAddress: '0xabc' }, undefined, url, 'Alice')).toBe('Alice');
    expect(channelLinkText({ groupName: 'Ops' }, undefined, url)).toBe('#Ops');
  });

  test('reads labels recursively through Markdown emphasis', () => {
    const label = markdownLabelText({ content: '', children: [{ content: '', children: [{ content: '#Ops', children: [] }] }] });
    expect(channelLinkLabel(undefined, label)).toBe('#Ops');
    expect(channelFallbackLabel('**#Ops**')).toBe('Ops');
    expect(channelFallbackLabel('***#Ops***')).toBe('Ops');
    expect(channelFallbackLabel('**join here**')).toBeUndefined();
  });

  test('uses one hash and a real name or supplied channel label, otherwise #channel', () => {
    expect(channelLinkLabel(' Ops (night) ')).toBe('#Ops (night)');
    expect(channelLinkLabel('##Ops', 'old')).toBe('#Ops');
    expect(channelLinkLabel('', 'Ops')).toBe('#Ops');
    expect(channelLinkLabel(undefined)).toBe('#channel');
    expect(channelLinkLabel('   ', ' # ')).toBe('#channel');
  });
});
