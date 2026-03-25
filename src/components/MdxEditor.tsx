import { useEffect, useRef } from "react";
import {
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  frontmatterPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { createTauriEditorAdapter } from "../editor/tauriBridge";
import type { EditorAdapter } from "../editor/types";
import { blockHandlePlugin } from "../plugins/blockHandlePlugin";
import { selectionFormatPlugin } from "../plugins/selectionFormatPlugin";
import { tauriEditorPlugin } from "../plugins/tauriEditorPlugin";

interface MdxEditorProps {
  onChange: (markdown: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function MdxEditor({ onChange, onReady }: MdxEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);

  useEffect(() => {
    const adapter = createTauriEditorAdapter({
      setMarkdown: (markdown) => {
        editorRef.current?.setMarkdown(markdown);
      },
      getMarkdown: () => editorRef.current?.getMarkdown() ?? "",
      focus: () => {
        editorRef.current?.focus(undefined, {
          defaultSelection: "rootEnd",
          preventScroll: true,
        });
      },
    });

    onReady(adapter);
    return () => {
      onReady(null);
    };
  }, [onReady]);

  return (
    <MDXEditor
      ref={editorRef}
      markdown=""
      contentEditableClassName="prose max-w-full"
      onChange={onChange}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        imagePlugin({
          imageUploadHandler: async (file) => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          },
        }),
        frontmatterPlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            js: "JavaScript",
            ts: "TypeScript",
            tsx: "TypeScript (React)",
            jsx: "JavaScript (React)",
            css: "CSS",
            html: "HTML",
            json: "JSON",
            rust: "Rust",
            py: "Python",
            txt: "Plain text",
          },
        }),
        markdownShortcutPlugin(),
        tauriEditorPlugin(),
        blockHandlePlugin(),
        selectionFormatPlugin(),
      ]}
    />
  );
}
