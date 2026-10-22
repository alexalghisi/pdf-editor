import { tokenizeContentStream } from '@/infrastructure/pdf/contentStream/tokenizer';

describe('tokenizeContentStream', () => {
  it('tokenizes a simple text object', () => {
    const tokens = tokenizeContentStream(
      'BT /F1 12 Tf 72 720 Td (Hello PDF) Tj ET',
    );

    expect(tokens.map((token) => token.kind)).toEqual([
      'operator',
      'name',
      'number',
      'operator',
      'number',
      'number',
      'operator',
      'string',
      'operator',
      'operator',
    ]);
    const shown = tokens.find((token) => token.kind === 'string');
    expect(shown).toEqual({ kind: 'string', value: 'Hello PDF' });
  });

  it('unescapes literal-string delimiters', () => {
    const tokens = tokenizeContentStream('(Hello \\(World\\))');
    expect(tokens).toEqual([{ kind: 'string', value: 'Hello (World)' }]);
  });

  it('decodes hex strings as latin-1', () => {
    const tokens = tokenizeContentStream('<48656C6C6F>');
    expect(tokens).toEqual([{ kind: 'string', value: 'Hello' }]);
  });

  it('keeps hex strings as raw bytes even when they start with FE FF', () => {
    const tokens = tokenizeContentStream('<FEFF0048>');
    expect(tokens).toEqual([{ kind: 'string', value: '\u00fe\u00ff\u0000H' }]);
  });

  it('parses arrays used by TJ', () => {
    const tokens = tokenizeContentStream('[(Hel) -20 (lo)] TJ');
    expect(tokens[0]).toEqual({
      kind: 'array',
      value: [
        { kind: 'string', value: 'Hel' },
        { kind: 'number', value: -20 },
        { kind: 'string', value: 'lo' },
      ],
    });
    expect(tokens[1]).toEqual({ kind: 'operator', value: 'TJ' });
  });

  it('ignores comments', () => {
    const tokens = tokenizeContentStream('% comment\n/Im1 Do');
    expect(tokens).toEqual([
      { kind: 'name', value: 'Im1' },
      { kind: 'operator', value: 'Do' },
    ]);
  });

  describe('inline images', () => {
    const image = 'BI /W 2 /H 1 /CS /G /BPC 8 ID ÿ) EI\nQ';

    it('keeps the image source, binary data included, as one token', () => {
      const tokens = tokenizeContentStream(`q ${image}`);

      expect(tokens).toEqual([
        { kind: 'operator', value: 'q' },
        {
          kind: 'inlineImage',
          value: 'BI /W 2 /H 1 /CS /G /BPC 8 ID ÿ) EI',
          entries: [
            { kind: 'name', value: 'W' },
            { kind: 'number', value: 2 },
            { kind: 'name', value: 'H' },
            { kind: 'number', value: 1 },
            { kind: 'name', value: 'CS' },
            { kind: 'name', value: 'G' },
            { kind: 'name', value: 'BPC' },
            { kind: 'number', value: 8 },
          ],
        },
        { kind: 'operator', value: 'Q' },
      ]);
    });

    it('does not stop at EI bytes inside the image data', () => {
      const tokens = tokenizeContentStream('BI /W 1 /H 1 ID xEIy EI');

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ value: 'BI /W 1 /H 1 ID xEIy EI' });
    });

    it('takes the rest of the stream when EI is missing', () => {
      const tokens = tokenizeContentStream('BI /W 1 /H 1 ID \u0001\u0002');

      expect(tokens).toEqual([
        expect.objectContaining({
          kind: 'inlineImage',
          value: 'BI /W 1 /H 1 ID \u0001\u0002',
        }),
      ]);
    });
  });
});
