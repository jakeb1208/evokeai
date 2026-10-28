import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function WorldPromptDialog({
  worldName,
  worldPrompt,
  marbleWorldId,
  onClose,
}: {
  worldName: string;
  worldPrompt: unknown;
  marbleWorldId: string | null;
  onClose: () => void;
}) {
  const promptRecord = isRecord(worldPrompt) ? worldPrompt : null;
  const textPrompt = typeof promptRecord?.text_prompt === 'string'
    ? promptRecord.text_prompt
    : '';
  const inputType = typeof promptRecord?.type === 'string' ? promptRecord.type : '';
  const [copyMessage, setCopyMessage] = useState('');

  async function copyPrompt() {
    if (!textPrompt) return;
    try {
      await navigator.clipboard.writeText(textPrompt);
      setCopyMessage('Prompt copied.');
    } catch {
      setCopyMessage('Copy unavailable. Select the prompt text to copy it.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="world-prompt-dialog">
        <DialogTitle>Prompt for {worldName}</DialogTitle>
        <DialogDescription>
          This is the text saved with this world. Photos are sent separately.
          New worlds keep the text sent to Marble; older worlds may show Marble’s returned version.
        </DialogDescription>
        {inputType ? <p className="world-prompt-type">Input type: {inputType}</p> : null}
        {textPrompt ? (
          <pre className="world-prompt-text">{textPrompt}</pre>
        ) : (
          <p className="world-prompt-empty">
            No text prompt is saved for this world. Older generation records may not have retained it.
          </p>
        )}
        <div className="world-prompt-actions">
          {marbleWorldId ? (
            <a
              className="world-prompt-marble-link"
              href={`https://marble.worldlabs.ai/world/${encodeURIComponent(marbleWorldId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Marble
            </a>
          ) : <span />}
          {copyMessage ? <span role="status">{copyMessage}</span> : null}
          <button type="button" onClick={() => void copyPrompt()} disabled={!textPrompt}>
            Copy prompt
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
