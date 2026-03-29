import { Compartment, EditorState } from "@codemirror/state";
import type { LanguageSupport } from "@codemirror/language";
import {
  EditorView as CodeMirror,
  type KeyBinding,
  type ViewUpdate,
  drawSelection,
  keymap as cmKeymap,
} from "@codemirror/view";
import { codeBlockConfig, type CodeBlockConfig } from "@milkdown/kit/component/code-block";
import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import { exitCode } from "@milkdown/kit/prose/commands";
import { redo, undo } from "@milkdown/kit/prose/history";
import type { Node } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import type {
  EditorView,
  NodeView,
  NodeViewConstructor,
} from "@milkdown/kit/prose/view";
import { $view } from "@milkdown/kit/utils";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CodeBlockLanguageDropdown,
  type CodeBlockLanguageDropdownItem,
} from "./CodeBlockLanguageDropdown";
import {
  CODE_BLOCK_LANGUAGE_OPTIONS,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  getCodeBlockLanguageOption,
  getCodeBlockLanguageSearchText,
  resolveCodeBlockLanguageValue,
} from "./codeBlockLanguages";
import { runCodeBlockCopy } from "./clipboardBridge";

type PreviewValue = null | string | HTMLElement;

type DropdownLanguageItem = CodeBlockLanguageDropdownItem<string>;

class LanguageLoader {
  private readonly map: Record<string, LanguageDescriptionLike>;

  constructor(languages: LanguageDescriptionLike[]) {
    this.map = {};

    for (const language of languages) {
      for (const alias of language.alias) {
        this.map[alias] = language;
      }
    }
  }

  load(languageName: string) {
    const language = this.map[languageName.trim().toLowerCase()];
    if (!language) return Promise.resolve(undefined);
    if (language.support) return Promise.resolve(language.support);
    return language.load();
  }
}

type LanguageDescriptionLike = {
  alias: readonly string[];
  support?: LanguageSupport;
  load: () => Promise<LanguageSupport | undefined>;
};

export const codeBlockView = $view(
  codeBlockSchema.node,
  (ctx): NodeViewConstructor => {
    const config = ctx.get(codeBlockConfig.key);
    const loader = new LanguageLoader(
      config.languages as unknown as LanguageDescriptionLike[],
    );

    return (node, view, getPos) =>
      new AppCodeMirrorBlock(node, view, getPos, loader, config);
  },
);

class AppCodeMirrorBlock implements NodeView {
  dom: HTMLElement;
  cm: CodeMirror;
  root: Root;

  private rawLanguage = "";
  private language = DEFAULT_CODE_BLOCK_LANGUAGE;
  private text = "";
  private selected = false;
  private preview: PreviewValue = null;
  private previewOnlyMode: boolean;
  private updating = false;
  private previewVersion = 0;
  private destroyed = false;
  private languageRequestVersion = 0;

  private readonly languageConf: Compartment;
  private readonly readOnlyConf: Compartment;

  constructor(
    public node: Node,
    public view: EditorView,
    public getPos: () => number | undefined,
    private readonly loader: LanguageLoader,
    private readonly config: CodeBlockConfig,
  ) {
    this.languageConf = new Compartment();
    this.readOnlyConf = new Compartment();
    this.previewOnlyMode =
      this.config.previewOnlyByDefault ?? !this.view.editable;
    this.text = this.node.textContent;

    this.cm = new CodeMirror({
      doc: this.text,
      root: this.view.root,
      extensions: [
        this.readOnlyConf.of(EditorState.readOnly.of(!this.view.editable)),
        drawSelection(),
        cmKeymap.of(this.codeMirrorKeymap()),
        this.languageConf.of([]),
        EditorState.changeFilter.of(() => this.view.editable),
        ...this.config.extensions,
        CodeMirror.updateListener.of(this.forwardUpdate),
      ],
    });

    this.dom = document.createElement("div");
    this.dom.className = "milkdown-code-block";
    this.root = createRoot(this.dom);

    this.syncLanguage();
    this.updatePreview();
    this.render();
  }

  private render() {
    this.dom.classList.toggle("selected", this.selected);

    this.root.render(
      <CodeBlockChrome
        codemirror={this.cm}
        copyText={this.config.copyText}
        language={this.language}
        rawLanguage={this.rawLanguage}
        preview={this.preview}
        previewOnlyMode={this.previewOnlyMode}
        readonly={!this.view.editable}
        text={this.text}
        onCopy={this.handleCopy}
        onLanguageSelect={this.setLanguage}
        onTogglePreview={() => {
          this.previewOnlyMode = !this.previewOnlyMode;
          this.render();
        }}
      />,
    );
  }

  private forwardUpdate = (update: ViewUpdate) => {
    if (this.updating || !this.cm.hasFocus) return;

    let offset = (this.getPos() ?? 0) + 1;
    const { main } = update.state.selection;
    const selFrom = offset + main.from;
    const selTo = offset + main.to;
    const pmSelection = this.view.state.selection;

    if (update.docChanged || pmSelection.from !== selFrom || pmSelection.to !== selTo) {
      const next = this.view.state.tr;
      update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
        if (text.length) {
          next.replaceWith(
            offset + fromA,
            offset + toA,
            this.view.state.schema.text(text.toString()),
          );
        } else {
          next.delete(offset + fromA, offset + toA);
        }

        offset += toB - fromB - (toA - fromA);
      });

      next.setSelection(TextSelection.create(next.doc, selFrom, selTo));
      this.view.dispatch(next);
    }
  };

  private syncLanguage() {
    const nextRawLanguage = String(this.node.attrs.language ?? "");
    const nextLanguage = resolveCodeBlockLanguageValue(nextRawLanguage);
    if (nextRawLanguage === this.rawLanguage && nextLanguage === this.language) return;

    this.rawLanguage = nextRawLanguage;
    this.language = nextLanguage;
    const requestVersion = ++this.languageRequestVersion;

    void this.loader
      .load(nextRawLanguage || nextLanguage)
      .then((language) => {
        if (
          this.destroyed ||
          requestVersion !== this.languageRequestVersion ||
          !this.cm.dom.isConnected
        ) {
          return;
        }
        this.cm.dispatch({
          effects: this.languageConf.reconfigure(language ? [language] : []),
        });
      })
      .catch((error) => {
        if (this.destroyed || requestVersion !== this.languageRequestVersion) {
          return;
        }
        console.error(error);
      });
  }

  private updatePreview() {
    const version = ++this.previewVersion;
    const applyPreview = (value: PreviewValue) => {
      if (version !== this.previewVersion) return;
      this.preview = value;
      this.render();
    };

    const result = this.config.renderPreview(
      this.language,
      this.text,
      applyPreview,
    );

    if (result === undefined) {
      this.preview = this.preview ?? this.config.previewLoading;
      this.render();
      return;
    }

    this.preview = result;
    this.render();
  }

  private handleCopy = () => {
    void runCodeBlockCopy(this.text);
  };

  private codeMirrorKeymap(): KeyBinding[] {
    const view = this.view;

    return [
      { key: "ArrowUp", run: () => this.maybeEscape("line", -1) },
      { key: "ArrowLeft", run: () => this.maybeEscape("char", -1) },
      { key: "ArrowDown", run: () => this.maybeEscape("line", 1) },
      { key: "ArrowRight", run: () => this.maybeEscape("char", 1) },
      {
        key: "Mod-Enter",
        run: () => {
          if (!exitCode(view.state, view.dispatch)) return false;
          view.focus();
          return true;
        },
      },
      { key: "Mod-z", run: () => undo(view.state, view.dispatch) },
      { key: "Shift-Mod-z", run: () => redo(view.state, view.dispatch) },
      { key: "Mod-y", run: () => redo(view.state, view.dispatch) },
      {
        key: "Backspace",
        run: () => {
          const ranges = this.cm.state.selection.ranges;
          if (ranges.length > 1) return false;

          const selection = ranges[0];
          if (selection && (!selection.empty || selection.anchor > 0)) {
            return false;
          }

          if (this.cm.state.doc.lines >= 2) return false;

          const pos = this.getPos() ?? 0;
          const next = this.view.state.tr.replaceWith(
            pos,
            pos + this.node.nodeSize,
            this.view.state.schema.nodes.paragraph!.createChecked(
              {},
              this.node.content,
            ),
          );

          next.setSelection(TextSelection.near(next.doc.resolve(pos)));
          this.view.dispatch(next);
          this.view.focus();
          return true;
        },
      },
    ];
  }

  private maybeEscape(unit: "line" | "char", direction: -1 | 1) {
    const { state } = this.cm;
    let selection = state.selection.main;
    if (!selection.empty) return false;

    if (unit === "line") {
      const line = state.doc.lineAt(selection.head);
      if (direction < 0 ? line.from > 0 : line.to < state.doc.length) return false;
    } else if (direction < 0 ? selection.from > 0 : selection.to < state.doc.length) {
      return false;
    }

    const targetPos = (this.getPos() ?? 0) + (direction < 0 ? 0 : this.node.nodeSize);
    const nextSelection = TextSelection.near(
      this.view.state.doc.resolve(targetPos),
      direction,
    );
    const next = this.view.state.tr.setSelection(nextSelection).scrollIntoView();
    this.view.dispatch(next);
    this.view.focus();
    return true;
  }

  setSelection(anchor: number, head: number) {
    if (!this.cm.dom.isConnected) return;

    this.cm.focus();
    this.updating = true;
    this.cm.dispatch({ selection: { anchor, head } });
    this.updating = false;
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false;
    if (this.updating) return true;

    this.node = node;
    this.text = node.textContent;
    this.syncLanguage();

    if (this.view.editable === this.cm.state.readOnly) {
      this.cm.dispatch({
        effects: this.readOnlyConf.reconfigure(
          EditorState.readOnly.of(!this.view.editable),
        ),
      });
    }

    const change = computeChange(this.cm.state.doc.toString(), node.textContent);
    if (change) {
      this.updating = true;
      this.cm.dispatch({
        changes: { from: change.from, to: change.to, insert: change.text },
        scrollIntoView: true,
      });
      this.updating = false;
    }

    this.updatePreview();
    return true;
  }

  selectNode() {
    this.selected = true;
    this.render();
    this.cm.focus();
  }

  deselectNode() {
    this.selected = false;
    this.render();
  }

  stopEvent() {
    return true;
  }

  destroy() {
    this.destroyed = true;
    this.languageRequestVersion += 1;
    this.root.unmount();
    this.cm.destroy();
  }

  private setLanguage = (language: string) => {
    this.view.dispatch(
      this.view.state.tr.setNodeAttribute(this.getPos() ?? 0, "language", language),
    );
  };
}

function CodeBlockChrome(props: {
  codemirror: CodeMirror;
  copyText: string;
  language: string;
  rawLanguage: string;
  preview: PreviewValue;
  previewOnlyMode: boolean;
  readonly: boolean;
  text: string;
  onCopy: () => void;
  onLanguageSelect: (value: string) => void;
  onTogglePreview: () => void;
}) {
  const {
    codemirror,
    copyText,
    language,
    rawLanguage,
    preview,
    previewOnlyMode,
    readonly,
    onCopy,
    onLanguageSelect,
    onTogglePreview,
  } = props;
  const codemirrorHostRef = useRef<HTMLDivElement | null>(null);
  const currentLanguage = useMemo(
    () => getCurrentLanguageOption(language, rawLanguage),
    [language, rawLanguage],
  );
  const languageItems = useMemo(
    () => buildLanguageItems(currentLanguage),
    [currentLanguage],
  );

  useEffect(() => {
    const host = codemirrorHostRef.current;
    if (!host) return;
    if (codemirror.dom.parentElement !== host) {
      host.replaceChildren(codemirror.dom);
    }
  }, [codemirror]);

  return (
    <>
      <div className="code-block-toolbar">
        <CodeBlockLanguageDropdown
          value={currentLanguage.value}
          items={languageItems}
          disabled={readonly}
          ariaLabel="Code block language"
          searchable
          searchPlaceholder="Search languages"
          onSelect={onLanguageSelect}
        />

        <div className="code-block-toolbar-actions">
          <CodeBlockToolbarButton
            className="btn btn-ghost btn-xs btn-frosted btn-recessed code-block-toolbar-button-recessed"
            label={copyText}
            title={copyText}
            onClick={onCopy}
          >
            <CopyGlyph className="h-3.5 w-3.5" />
          </CodeBlockToolbarButton>

          {preview ? (
            <CodeBlockToolbarButton
              label={previewOnlyMode ? "Show code" : "Show preview"}
              title={previewOnlyMode ? "Show code" : "Show preview"}
              active={previewOnlyMode}
              onClick={onTogglePreview}
            >
              {previewOnlyMode ? (
                <CodeGlyph className="h-3.5 w-3.5" />
              ) : (
                <EyeGlyph className="h-3.5 w-3.5" />
              )}
              <span>{previewOnlyMode ? "Code" : "Preview"}</span>
            </CodeBlockToolbarButton>
          ) : null}
        </div>
      </div>

      <div
        ref={codemirrorHostRef}
        className={preview && previewOnlyMode ? "hidden" : "codemirror-host"}
      />

      {preview ? (
        <div className={previewOnlyMode ? "code-block-preview" : "code-block-preview hidden"}>
          <PreviewContent value={preview} />
        </div>
      ) : null}
    </>
  );
}

function CodeBlockToolbarButton(props: {
  active?: boolean;
  className?: string;
  children: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
}) {
  const { active = false, className, children, label, title, onClick } = props;

  return (
    <button
      type="button"
      className={[
        "code-block-toolbar-button",
        active ? "code-block-toolbar-button-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={title}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PreviewContent({ value }: { value: PreviewValue }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (value instanceof HTMLElement) {
      host.replaceChildren(value);
      return;
    }

    host.replaceChildren();
    if (typeof value === "string") {
      host.innerHTML = value;
    }
  }, [value]);

  return <div ref={hostRef} className="code-block-preview-content" />;
}

function getCurrentLanguageOption(language: string, rawLanguage: string) {
  const known =
    getCodeBlockLanguageOption(rawLanguage) ??
    getCodeBlockLanguageOption(language) ??
    getCodeBlockLanguageOption(DEFAULT_CODE_BLOCK_LANGUAGE);

  if (known) {
    return {
      value: known.id,
      id: known.id,
      label: known.label,
      aliases: known.aliases,
    };
  }

  const fallback = rawLanguage.trim() || language.trim() || DEFAULT_CODE_BLOCK_LANGUAGE;
  return {
    value: fallback,
    id: fallback,
    label: "Custom language",
    aliases: [],
  };
}

function buildLanguageItems(currentLanguage: {
  value: string;
  id: string;
  label: string;
  aliases: readonly string[];
}): DropdownLanguageItem[] {
  const currentOption = getCodeBlockLanguageOption(currentLanguage.value);
  const items = CODE_BLOCK_LANGUAGE_OPTIONS.map<DropdownLanguageItem>((option) => ({
    value: option.id,
    label: option.id,
    searchText: getCodeBlockLanguageSearchText(option),
  }));

  if (currentOption || currentLanguage.value === DEFAULT_CODE_BLOCK_LANGUAGE) {
    return items;
  }

  return [
    {
      value: currentLanguage.value,
      label: currentLanguage.id,
      searchText: [currentLanguage.id, currentLanguage.label],
    },
    ...items,
  ];
}


function computeChange(previous: string, next: string) {
  if (previous === next) return null;

  let from = 0;
  const previousLength = previous.length;
  const nextLength = next.length;

  while (
    from < previousLength &&
    from < nextLength &&
    previous.charCodeAt(from) === next.charCodeAt(from)
  ) {
    from += 1;
  }

  let previousEnd = previousLength;
  let nextEnd = nextLength;

  while (
    previousEnd > from &&
    nextEnd > from &&
    previous.charCodeAt(previousEnd - 1) === next.charCodeAt(nextEnd - 1)
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return {
    from,
    to: previousEnd,
    text: next.slice(from, nextEnd),
  };
}

function CodeGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 3.5 1.75 8 5 12.5M11 3.5 14.25 8 11 12.5M9 2.5 7 13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5.5 5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M3.5 10.5h-.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1V4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M1.5 8s2.3-3.75 6.5-3.75S14.5 8 14.5 8s-2.3 3.75-6.5 3.75S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="8"
        cy="8"
        r="1.9"
        stroke="currentColor"
        strokeWidth="1.35"
      />
    </svg>
  );
}
