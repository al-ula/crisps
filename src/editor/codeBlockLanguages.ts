import { catppuccinLatte, catppuccinMocha } from "@catppuccin/codemirror";
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from "@codemirror/language";
import { languages as languageData } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { stex } from "@codemirror/legacy-modes/mode/stex";

export interface CodeBlockLanguageOption {
  id: string;
  label: string;
  aliases: readonly string[];
  searchText: readonly string[];
}

type PinnedLanguageDefinition = {
  id: string;
  label: string;
  aliases: readonly string[];
  match?: string | readonly string[];
  support?: LanguageSupport;
};

const latexSupport = new LanguageSupport(StreamLanguage.define(stex));

const PINNED_LANGUAGE_DEFINITIONS: readonly PinnedLanguageDefinition[] = [
  {
    id: "txt",
    label: "Plain text",
    aliases: ["text", "plain", "plain-text"],
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
    id: "html",
    label: "HTML",
    aliases: [],
    match: "HTML",
  },
  {
    id: "css",
    label: "CSS",
    aliases: [],
    match: "CSS",
  },
  {
    id: "json",
    label: "JSON",
    aliases: ["json5"],
    match: "JSON",
  },
  {
    id: "md",
    label: "Markdown",
    aliases: ["markdown"],
    match: "Markdown",
  },
  {
    id: "bash",
    label: "Shell",
    aliases: ["shell", "sh", "zsh"],
    match: "Shell",
  },
  {
    id: "sql",
    label: "SQL",
    aliases: [],
    match: "SQL",
  },
  {
    id: "py",
    label: "Python",
    aliases: ["python"],
    match: "Python",
  },
  {
    id: "rust",
    label: "Rust",
    aliases: ["rs"],
    match: "Rust",
  },
  {
    id: "latex",
    label: "LaTeX",
    aliases: ["tex"],
    match: "LaTeX",
    support: latexSupport,
  },
] as const;

export const DEFAULT_CODE_BLOCK_LANGUAGE = "txt";

const BUILT_CODE_BLOCK_LANGUAGES = buildCodeBlockLanguages();

export const CODE_BLOCK_LANGUAGE_OPTIONS = BUILT_CODE_BLOCK_LANGUAGES.options;
export const CODE_BLOCK_CODEMIRROR_LANGUAGES = BUILT_CODE_BLOCK_LANGUAGES.languages;

const CODE_BLOCK_LANGUAGE_LOOKUP = BUILT_CODE_BLOCK_LANGUAGES.lookup;

export function getCodeBlockExtensions(isDarkTheme: boolean): Extension[] {
  return [isDarkTheme ? catppuccinMocha : catppuccinLatte];
}

export function renderCodeBlockLanguage(language: string): string {
  const entry = getCodeBlockLanguageOption(language);
  if (!entry) return language;
  return `${entry.id} (${entry.label})`;
}

export function getCodeBlockLanguageOption(
  language: string | null | undefined,
): CodeBlockLanguageOption | null {
  const normalized = normalizeLanguage(language);
  if (!normalized) return null;
  return CODE_BLOCK_LANGUAGE_LOOKUP.get(normalized) ?? null;
}

export function resolveCodeBlockLanguageValue(
  language: string | null | undefined,
): string {
  const entry = getCodeBlockLanguageOption(language);
  const normalized = normalizeLanguage(language);
  if (entry) return entry.id;
  return normalized || DEFAULT_CODE_BLOCK_LANGUAGE;
}

export function getCodeBlockLanguageSearchText(
  option: CodeBlockLanguageOption,
) {
  return option.searchText;
}

function buildCodeBlockLanguages() {
  const options: CodeBlockLanguageOption[] = [];
  const languages: LanguageDescription[] = [];
  const lookup = new Map<string, CodeBlockLanguageOption>();
  const knownAliases = new Set<string>();

  for (const definition of PINNED_LANGUAGE_DEFINITIONS) {
    const source = resolveLanguageSource(definition.match);
    registerLanguage(
      {
        id: definition.id,
        label: definition.label,
        aliases: uniqueNormalized(
          definition.aliases,
          source?.alias ?? [],
          source?.extensions ?? [],
        ),
        support: definition.support,
        source,
      },
      options,
      languages,
      lookup,
      knownAliases,
    );
  }

  const additional = languageData
    .filter((source) => {
      const names = uniqueNormalized(source.name, source.alias ?? []);
      return !names.some((value) => knownAliases.has(value));
    })
    .map((source) => {
      const aliases = uniqueNormalized(source.alias ?? [], source.extensions ?? []);
      const id = pickCanonicalId(source);
      return {
        id,
        label: source.name,
        aliases,
        source,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  for (const entry of additional) {
    registerLanguage(entry, options, languages, lookup, knownAliases);
  }

  return {
    options,
    languages: languages as unknown as LanguageDescription[],
    lookup,
  };
}

function registerLanguage(
  entry: {
    id: string;
    label: string;
    aliases: readonly string[];
    source?: LanguageDescription;
    support?: LanguageSupport;
  },
  options: CodeBlockLanguageOption[],
  languages: LanguageDescription[],
  lookup: Map<string, CodeBlockLanguageOption>,
  knownAliases: Set<string>,
) {
  const id = normalizeLanguage(entry.id) || DEFAULT_CODE_BLOCK_LANGUAGE;
  const aliases = uniqueNormalized(entry.aliases).filter((value) => value !== id);
  const option: CodeBlockLanguageOption = {
    id,
    label: entry.label,
    aliases,
    searchText: uniqueNormalized(entry.label, id, aliases),
  };

  options.push(option);
  languages.push(
    createCodeMirrorLanguage(option, entry.source, entry.support),
  );

  for (const key of [id, ...aliases, normalizeLanguage(entry.label)]) {
    if (!key) continue;
    lookup.set(key, option);
    knownAliases.add(key);
  }
}

function createCodeMirrorLanguage(
  option: CodeBlockLanguageOption,
  source?: LanguageDescription,
  support?: LanguageSupport,
): LanguageDescription {
  return {
    name: option.id,
    alias: uniqueNormalized(option.id, option.label, option.aliases),
    extensions: source?.extensions ?? [],
    filename: source?.filename,
    support: support ?? source?.support,
    load: () =>
      support
        ? Promise.resolve(support)
        : source?.load() ?? Promise.resolve(undefined),
  } as unknown as LanguageDescription;
}

function resolveLanguageSource(
  match?: string | readonly string[],
): LanguageDescription | undefined {
  if (!match) return undefined;
  const candidates = Array.isArray(match) ? match : [match];
  return candidates
    .map((candidate) =>
      LanguageDescription.matchLanguageName(languageData, candidate),
    )
    .find((value): value is LanguageDescription => value != null);
}

function pickCanonicalId(source: LanguageDescription) {
  const candidates = uniqueNormalized(source.alias ?? []);
  const preferred = candidates.find(
    (candidate) =>
      /^[a-z0-9][a-z0-9#+-]*$/i.test(candidate) && !candidate.includes(" "),
  );
  return preferred ?? normalizeLanguage(source.name) ?? DEFAULT_CODE_BLOCK_LANGUAGE;
}

function uniqueNormalized(...values: Array<string | readonly string[]>) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values.flat()) {
    const normalized = normalizeLanguage(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeLanguage(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : "";
}
