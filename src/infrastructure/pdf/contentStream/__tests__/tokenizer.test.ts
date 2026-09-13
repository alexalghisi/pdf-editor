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
});
