import { describe, expect, it } from 'vitest';
import { parseJsonOutput } from '../structured';

describe('parseJsonOutput', () => {
  it('parses plain JSON objects', () => {
    expect(parseJsonOutput('{"ok":true,"count":2}')).toEqual({
      ok: true,
      value: { ok: true, count: 2 },
    });
  });

  it('parses fenced JSON blocks', () => {
    expect(parseJsonOutput('```json\n{"title":"主图"}\n```')).toEqual({
      ok: true,
      value: { title: '主图' },
    });
  });

  it('parses the first embedded JSON object in text', () => {
    expect(parseJsonOutput('模型输出如下：{"cards":[{"id":"a"}]} 备选：{"ignored":true}')).toEqual({
      ok: true,
      value: { cards: [{ id: 'a' }] },
    });
  });

  it('rejects non JSON text', () => {
    expect(parseJsonOutput('没有结构化内容')).toEqual({ ok: false });
  });
});
