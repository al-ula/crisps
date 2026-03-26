import { catppuccinLatte, catppuccinMocha } from "@catppuccin/codemirror";
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from "@codemirror/language";
import { languages as languageData } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { stex } from "@codemirror/legacy-modes/mode/stex";

type CodeBlockLanguageOption = {
  id: string;
  label: string;
  aliases: readonly string[];
  match: string | readonly string[];
  support?: LanguageSupport;
};

const latexSupport = new LanguageSupport(StreamLanguage.define(stex));

export const CODE_BLOCK_LANGUAGE_OPTIONS: readonly CodeBlockLanguageOption[] = [
  {
    id: "txt",
    label: "Plain text",
    aliases: ["text", "plain", "plain-text"],
    match: [],
  },
  {
    id: "js",
    label: "JavaScript",
    aliases: ["javascript", "ecmascript", "node"],
    match: "JavaScript",
  },
  {
    id: "ts",
    label: "TypeScript",
    aliases: ["typescript"],
    match: "TypeScript",
  },
  {
    id: "tsx",
    label: "TypeScript (React)",
    aliases: ["typescriptreact", "typescript-react"],
    match: "TSX",
  },
  {
    id: "jsx",
    label: "JavaScript (React)",
    aliases: ["javascriptreact", "javascript-react"],
    match: "JSX",
  },
  {
    id: "css",
    label: "CSS",
    aliases: [],
    match: "CSS",
  },
  {
    id: "html",
    label: "HTML",
    aliases: [],
    match: "HTML",
  },
  {
    id: "json",
    label: "JSON",
    aliases: ["json5"],
    match: "JSON",
  },
  {
    id: "rust",
    label: "Rust",
    aliases: ["rs"],
    match: "Rust",
  },
  {
    id: "py",
    label: "Python",
    aliases: ["python"],
    match: "Python",
  },
  {
    id: "latex",
    label: "LaTeX",
    aliases: ["tex"],
    match: [],
    support: latexSupport,
  },
] as const;

const CODE_BLOCK_LANGUAGE_LOOKUP = new Map(
  CODE_BLOCK_LANGUAGE_OPTIONS.flatMap(({ id, label, aliases }) => [
    [id, { id, label }] as const,
    ...aliases.map((alias) => [alias, { id, label }] as const),
  ]),
);

export const DEFAULT_CODE_BLOCK_LANGUAGE = "txt";

export const CODE_BLOCK_CODEMIRROR_LANGUAGES = CODE_BLOCK_LANGUAGE_OPTIONS.map(
  (option) => createCodeMirrorLanguage(option),
) as unknown as LanguageDescription[];

export function getCodeBlockExtensions(isDarkTheme: boolean): Extension[] {
  return [isDarkTheme ? catppuccinMocha : catppuccinLatte];
}

export function renderCodeBlockLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  const entry = CODE_BLOCK_LANGUAGE_LOOKUP.get(normalized);
  return entry ? `${entry.id} (${entry.label})` : language;
}

function createCodeMirrorLanguage(
  option: CodeBlockLanguageOption,
): LanguageDescription {
  const matchers = Array.isArray(option.match) ? option.match : [option.match];
  const source = matchers
    .map((matcher) => LanguageDescription.matchLanguageName(languageData, matcher))
    .find((value): value is LanguageDescription => value != null);

  return {
    name: option.id,
    alias: [
      option.id,
      option.label.toLowerCase(),
      ...option.aliases.map((alias) => alias.toLowerCase()),
    ],
    extensions: source?.extensions ?? [],
    filename: source?.filename,
    support: option.support ?? source?.support,
    load: () =>
      option.support
        ? Promise.resolve(option.support)
        : source?.load() ?? Promise.resolve(undefined),
  } as unknown as LanguageDescription;
}
