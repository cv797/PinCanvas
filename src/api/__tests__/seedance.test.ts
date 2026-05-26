import { describe, expect, it } from 'vitest';
import { buildSeedanceVideoVars, normalizeSeedanceResolution } from '../seedance';
import { videoResultToUrl } from '../videos';

describe('buildSeedanceVideoVars', () => {
  it('builds text-to-video vars without image fields', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'seedance-2',
      prompt: 'a city at dawn',
      duration: '3s',
      ratio: '16:9',
      resolution: '720p',
      imageUrls: [],
      mode: 'omni-reference',
    });

    expect(vars.mode).toBe('text_to_video');
    expect(vars.duration).toBe(4);
    expect(vars).not.toHaveProperty('primaryImageUrl');
    expect(vars).not.toHaveProperty('imageUrls');
    expect(vars.metadata).toMatchObject({
      ratio: '16:9',
      resolution: '720p',
      generate_audio: true,
    });
  });

  it('builds single image-to-video vars', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'seedance-2',
      prompt: 'animate it',
      duration: '5s',
      ratio: '9:16',
      resolution: '1080p',
      imageUrls: ['https://example.com/a.png'],
      mode: 'omni-reference',
    });

    expect(vars.mode).toBe('image_to_video');
    expect(vars.primaryImageUrl).toBe('https://example.com/a.png');
    expect(vars.size).toBe('1080x1920');
  });

  it('builds first-last-frame vars with exactly two images', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'seedance-2',
      prompt: 'transition',
      duration: '10s',
      ratio: '1:1',
      resolution: '720p',
      imageUrls: ['https://example.com/a.png', 'https://example.com/b.png', 'https://example.com/c.png'],
      mode: 'first-last-frame',
    });

    expect(vars.mode).toBe('first_last_frame');
    expect(vars.imageUrls).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
    expect(vars.metadata).toMatchObject({
      content: [
        { type: 'text', text: 'transition' },
        { type: 'image_url', role: 'first_frame', image_url: { url: 'https://example.com/a.png' } },
        { type: 'image_url', role: 'last_frame', image_url: { url: 'https://example.com/b.png' } },
        { type: 'image_url', role: 'last_frame', image_url: { url: 'https://example.com/c.png' } },
      ],
    });
  });

  it('builds multi-ref vars with video reference in metadata', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'seedance-2',
      prompt: 'use references',
      duration: '15s',
      ratio: '4:3',
      resolution: '720p',
      imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
      videoUrl: 'https://example.com/ref.mp4',
      mode: 'omni-reference',
    });

    expect(vars.mode).toBe('multi_ref');
    expect(vars.imageUrls).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
    expect(vars.metadata).toMatchObject({
      video_urls: ['https://example.com/ref.mp4'],
      content: [
        { type: 'text', text: 'use references' },
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: 'https://example.com/a.png' },
        },
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: 'https://example.com/b.png' },
        },
        {
          type: 'video_url',
          role: 'reference_video',
          video_url: { url: 'https://example.com/ref.mp4' },
        },
      ],
    });
  });

  it('rejects audio-only omni-reference vars before sending to Seedance', () => {
    expect(() =>
      buildSeedanceVideoVars({
        modelName: 'seedance-2',
        prompt: 'use audio',
        duration: '8s',
        ratio: '16:9',
        resolution: '720p',
        imageUrls: [],
        audioUrls: ['https://example.com/ref.mp3'],
        mode: 'omni-reference',
      }),
    ).toThrow('Seedance 全能参考不能只连接音频');
  });

  it('builds multi-ref vars with audio and image references in metadata', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'seedance-2',
      prompt: 'use audio',
      duration: '8s',
      ratio: '16:9',
      resolution: '720p',
      imageUrls: ['https://example.com/a.png'],
      audioUrls: ['https://example.com/ref.mp3'],
      mode: 'omni-reference',
    });

    expect(vars.mode).toBe('multi_ref');
    expect(vars.imageUrls).toEqual(['https://example.com/a.png']);
    expect(vars.metadata).toMatchObject({
      audio_urls: ['https://example.com/ref.mp3'],
      reference_audio_urls: ['https://example.com/ref.mp3'],
      content: [
        { type: 'text', text: 'use audio' },
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: 'https://example.com/a.png' },
        },
        {
          type: 'audio_url',
          role: 'reference_audio',
          audio_url: { url: 'https://example.com/ref.mp3' },
        },
      ],
    });
  });

  it('keeps doubao seedance omni-reference images as reference images', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'doubao-seedance-2-0-260128',
      prompt: 'keep both as style references',
      duration: '6s',
      ratio: '16:9',
      resolution: '720p',
      imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
      mode: 'omni-reference',
    });

    expect(vars.mode).toBe('multi_ref');
    expect(vars.metadata).toMatchObject({
      content: [
        { type: 'text', text: 'keep both as style references' },
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: 'https://example.com/a.png' },
        },
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: 'https://example.com/b.png' },
        },
      ],
    });
  });

  it('keeps seedance-2-fast at 720p when 1080p is supplied', () => {
    expect(normalizeSeedanceResolution('seedance-2-fast', '1080p')).toBe('720p');
  });

  it('falls back unsupported resolutions to 720p', () => {
    expect(normalizeSeedanceResolution('seedance-2', '480p')).toBe('720p');
  });

  it('treats doubao seedance 2.0 as a seedance-style model', () => {
    const vars = buildSeedanceVideoVars({
      modelName: 'doubao-seedance-2-0-260128',
      prompt: 'cinematic shot',
      duration: '10s',
      ratio: '16:9',
      resolution: '1080p',
      imageUrls: ['https://example.com/a.png'],
      mode: 'omni-reference',
    });

    expect(vars.mode).toBe('image_to_video');
    expect(vars.primaryImageUrl).toBe('https://example.com/a.png');
    expect(vars.metadata).toMatchObject({
      duration: 10,
      resolution: '1080p',
      generate_audio: true,
    });
  });
});

describe('videoResultToUrl', () => {
  it('reads common OpenAI video metadata urls', () => {
    expect(videoResultToUrl({ metadata: { video_url: 'https://example.com/out.mp4' } })).toBe(
      'https://example.com/out.mp4',
    );
    expect(videoResultToUrl({ metadata: { result_url: 'https://example.com/result.mp4' } })).toBe(
      'https://example.com/result.mp4',
    );
  });
});
