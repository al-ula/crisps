import { MilkdownEditor } from "./MilkdownEditor";
import type { EditorAdapter } from "../editor/types";

interface EditorHostProps {
  isDarkTheme: boolean;
  onChange: (markdown: string) => void;
  onWriteClipboard?: (payload: {
    text: string;
    operation: "copy" | "cut";
    source: "selection" | "code-block";
  }) => Promise<void>;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function EditorHost({
  isDarkTheme,
  onChange,
  onWriteClipboard,
  onReady,
}: EditorHostProps) {
  return (
    <MilkdownEditor
      isDarkTheme={isDarkTheme}
      onChange={onChange}
      onWriteClipboard={onWriteClipboard}
      onReady={onReady}
    />
  );
}
