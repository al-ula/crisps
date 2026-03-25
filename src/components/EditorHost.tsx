import { Suspense, lazy } from "react";
import { EDITOR_ENGINE } from "../editor/flags";
import type { EditorAdapter } from "../editor/types";

const MdxEditor = lazy(async () => {
  const module = await import("./MdxEditor");
  return { default: module.MdxEditor };
});

const MilkdownEditor = lazy(async () => {
  const module = await import("./MilkdownEditor");
  return { default: module.MilkdownEditor };
});

interface EditorHostProps {
  onChange: (markdown: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function EditorHost({ onChange, onReady }: EditorHostProps) {
  const ActiveEditor = EDITOR_ENGINE === "milkdown" ? MilkdownEditor : MdxEditor;

  return (
    <Suspense fallback={<div className="h-full" />}>
      <ActiveEditor onChange={onChange} onReady={onReady} />
    </Suspense>
  );
}
