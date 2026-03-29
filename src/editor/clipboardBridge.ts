let codeBlockCopyHandler: ((text: string) => Promise<void>) | null = null;

export function setCodeBlockCopyHandler(
  handler: ((text: string) => Promise<void>) | null,
) {
  codeBlockCopyHandler = handler;
}

export function runCodeBlockCopy(text: string): Promise<void> {
  return codeBlockCopyHandler?.(text) ?? Promise.resolve();
}
