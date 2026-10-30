import { useEffect, useRef, useState } from "react";
import type { QuestPanoramaViewpoint } from "@workspace/api-client-react";
import type { QuestViewpointControls } from "../lib/quest-panorama-capture";
import { QuestPanoramaPreview } from "./quest-panorama-preview";
import "./quest-viewpoint.css";

type Props = {
  worldId: string;
  accessToken: string;
  controls: React.RefObject<QuestViewpointControls | null>;
  initialViewpoint?: QuestPanoramaViewpoint;
  hasOriginal: boolean;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onSavedChange: (point: QuestPanoramaViewpoint | undefined) => void;
};
const api = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

async function payload(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The request failed. Please retry.");
  return data;
}

export function QuestViewpointPanel({ worldId, accessToken, controls, initialViewpoint,
  hasOriginal, onClose, onBusyChange, onSavedChange }: Props) {
  const [saved, setSaved] = useState(initialViewpoint);
  const [capture, setCapture] = useState<{ blob: Blob; url: string; viewpoint: QuestPanoramaViewpoint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [height, setHeight] = useState(controls.current?.getViewpoint().y ?? 1.65);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endpoint = `${api}/worlds/${encodeURIComponent(worldId)}/quest-panorama`;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abortRef.current?.abort(); };
  }, []);
  useEffect(() => () => { if (capture) URL.revokeObjectURL(capture.url); }, [capture]);
  useEffect(() => {
    onBusyChange(busy);
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    if (busy) window.addEventListener("beforeunload", prevent);
    return () => { window.removeEventListener("beforeunload", prevent); onBusyChange(false); };
  }, [busy, onBusyChange]);

  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    const controller = new AbortController(); abortRef.current = controller;
    try { await action(controller.signal); }
    catch (cause) {
      if (mounted.current && !controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Could not complete this action.");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const takeCapture = () => void run(async () => {
    if (!controls.current) throw new Error("Wait for the world to finish loading.");
    const result = await controls.current.capture();
    if (mounted.current) setCapture({ ...result, url: URL.createObjectURL(result.blob) });
  });
  const save = () => void run(async (signal) => {
    if (!capture) return;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const upload = await payload(await fetch(`${endpoint}/upload`, { method: "POST", headers, signal }));
    const uploaded = await fetch(upload.upload_url, {
      method: "PUT", body: capture.blob, signal,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "max-age=3600" },
    });
    if (!uploaded.ok) throw new Error("The image upload failed. Your current Quest panorama has not changed.");
    await payload(await fetch(endpoint, {
      method: "PUT", signal, headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id: upload.upload_id, viewpoint: capture.viewpoint }),
    }));
    if (mounted.current) {
      setSaved(capture.viewpoint); setCapture(null);
      onSavedChange(capture.viewpoint);
      setMessage("Saved for Quest. In the headset, refresh your worlds and reopen this world. No new Unity renderer is needed.");
    }
  });
  const restore = () => void run(async (signal) => {
    await payload(await fetch(endpoint, { method: "DELETE", signal,
      headers: { Authorization: `Bearer ${accessToken}` } }));
    if (mounted.current) {
      setSaved(undefined); setCapture(null);
      onSavedChange(undefined);
      setMessage(hasOriginal ? "Original panorama restored. Reopen the world in Quest." : "Custom panorama removed.");
    }
  });
  return (
    <aside className="quest-viewpoint-panel" role="dialog" aria-label="Quest starting viewpoint" aria-busy={busy}>
      <header><h2>Quest starting viewpoint</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close Quest viewpoint settings">×</button>
      </header>
      <p>{saved ? "A custom Quest panorama is saved." : "Quest currently uses the original panorama."}</p>
      {capture ? <>
        <QuestPanoramaPreview url={capture.url} />
        <p>Drag the preview or focus it and use arrow keys to inspect every direction. This captures the existing scene; it does not repair missing or distorted details.</p>
        <div className="quest-viewpoint-actions">
          <button type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save for Quest"}</button>
          <button type="button" disabled={busy} onClick={() => setCapture(null)}>Retake</button>
        </div>
      </> : <>
        <p>Click the room, use WASD / arrows to move near its center, and move the mouse to choose the forward view. Press Esc to return here.</p>
        <label>Eye height: {height.toFixed(2)} m
          <input aria-label="Quest eye height" type="range" min="0.6" max="2.4" step="0.05"
            disabled={busy} value={height} onChange={(event) => {
              const value = Number(event.target.value); setHeight(value); controls.current?.setHeight(value);
            }} />
        </label>
        <div className="quest-viewpoint-actions" aria-label="Adjust camera position">
          {[["Forward", 0, -1], ["Back", 0, 1], ["Left", -1, 0], ["Right", 1, 0]].map(([label, x, z]) =>
            <button type="button" key={String(label)} disabled={busy} onClick={() => {
              const point = controls.current?.getViewpoint();
              if (!point) return;
              const c = Math.cos(point.yaw), s = Math.sin(point.yaw);
              controls.current?.setViewpoint({ ...point,
                x: point.x + (Number(x) * c + Number(z) * s) * 0.25,
                z: point.z + (-Number(x) * s + Number(z) * c) * 0.25 });
            }}>{label} 0.25 m</button>)}
        </div>
        <div className="quest-viewpoint-actions">
          <button type="button" disabled={busy} onClick={takeCapture}>{busy ? "Capturing 360°…" : "Capture this position"}</button>
          <button type="button" disabled={busy} onClick={() => {
            controls.current?.reset(); setHeight(1.65);
          }}>Reset camera</button>
          {saved ? <button type="button" disabled={busy} onClick={() => {
            controls.current?.setViewpoint(saved); setHeight(saved.y);
          }}>Go to saved position</button> : null}
        </div>
      </>}
      {saved ? <button className="quest-restore" type="button" disabled={busy} onClick={restore}>
        {hasOriginal ? "Restore original Quest panorama" : "Remove custom Quest panorama"}
      </button> : null}
      <p className="quest-viewpoint-note">Fixed 360° viewpoint, not walking. Your original panorama stays saved. Position is chosen manually—not an estimated room center.</p>
      <p role="status">{message}</p>
      {error ? <p className="quest-viewpoint-error" role="alert">{error}</p> : null}
    </aside>
  );
}
