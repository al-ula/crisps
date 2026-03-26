import { MilkdownEditor } from "./MilkdownEditor";
import type { EditorAdapter } from "../editor/types";

interface EditorHostProps {
  isDarkTheme: boolean;
  onChange: (markdown: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function EditorHost({ isDarkTheme, onChange, onReady }: EditorHostProps) {
  return (
    <MilkdownEditor
      isDarkTheme={isDarkTheme}
      onChange={onChange}
      onReady={onReady}
    />
  );
}
