import { useMemo } from 'react';
import { createCssVariablesTheme, createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import json from 'shiki/langs/json.mjs';
import sql from 'shiki/langs/sql.mjs';

export type CodeLang = 'json' | 'sql';

// Token colours come from the --shiki-* variables in index.css.
const THEME = 'css-variables';

const highlighter = createHighlighterCoreSync({
  themes: [createCssVariablesTheme({ name: THEME, fontStyle: false })],
  langs: [json, sql],
  engine: createJavaScriptRegexEngine(),
});

interface Segment {
  key: number;
  content: string;
  color?: string;
}

function tokenize(code: string, lang: CodeLang): Segment[] {
  const { tokens } = highlighter.codeToTokens(code, { lang, theme: THEME });
  const segments: Segment[] = [];
  let key = 0;
  tokens.forEach((line, lineIndex) => {
    if (lineIndex > 0) segments.push({ key: key++, content: '\n' });
    for (const token of line) {
      segments.push({ key: key++, content: token.content, color: token.color });
    }
  });
  return segments;
}

export function HighlightedCode({
  code,
  lang,
}: {
  code: string;
  lang: CodeLang;
}) {
  const segments = useMemo(() => tokenize(code, lang), [code, lang]);
  return segments.map(({ key, content, color }) => (
    <span key={key} style={color ? { color } : undefined}>
      {content}
    </span>
  ));
}
