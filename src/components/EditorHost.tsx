import { EDITOR_ENGINE } from "../editor/flags";
import type { EditorAdapter } from "../editor/types";
import { MdxEditor } from "./MdxEditor";
import { MilkdownEditor } from "./MilkdownEditor";

interface EditorHostProps {
  onChange: (markdown: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function EditorHost({ onChange, onReady }: EditorHostProps) {
  if (EDITOR_ENGINE === "milkdown") {
    return <MilkdownEditor onChange={onChange} onReady={onReady} />;
  }

  return <MdxEditor onChange={onChange} onReady={onReady} />;
}
