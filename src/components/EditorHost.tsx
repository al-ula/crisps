import { MilkdownEditor } from "./MilkdownEditor";
import type { EditorAdapter } from "../editor/types";

interface EditorHostProps {
  onChange: (markdown: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function EditorHost({ onChange, onReady }: EditorHostProps) {
  return <MilkdownEditor onChange={onChange} onReady={onReady} />;
}
