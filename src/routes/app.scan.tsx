import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, CameraOff, KeyRound, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const CAMERA_CONFIG = { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 };

export const Route = createFileRoute("/app/scan")({
  component: ScanPage,
});

function ScanPage() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<string>("");

  async function submitCode(code: string) {
    if (!code || busy) return;
    if (code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("scan_qr_code", { _qr: code });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; points?: number; activity?: string };
      if (!res.ok) {
        toast.error(res.error ?? "Scan failed");
      } else {
        toast.success(`+${res.points} points — ${res.activity}`);
        qc.invalidateQueries();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
      setTimeout(() => {
        lastCodeRef.current = "";
      }, 3000);
    }
  }

  const inIframe = typeof window !== "undefined" && window.self !== window.top;

  async function startScanner() {
    if (scannerRef.current) return;
    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      toast.error("Camera requires HTTPS. Open the published link.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support camera access.");
      return;
    }

    // Show the camera container BEFORE creating the scanner so the div exists
    // and is empty (html5-qrcode requires an empty target element).
    setScanning(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const target = document.getElementById("qr-reader");
    if (target) target.innerHTML = "";

    let inst: Html5Qrcode;
    try {
      inst = new Html5Qrcode("qr-reader", { verbose: false } as never);
    } catch (e) {
      toast.error("Could not initialize scanner.");
      setScanning(false);
      return;
    }
    scannerRef.current = inst;

    const onDecoded = (decoded: string) => submitCode(decoded);
    const onErr = () => {};

    try {
      try {
        await inst.start({ facingMode: { ideal: "environment" } }, CAMERA_CONFIG, onDecoded, onErr);
      } catch (firstErr) {
        // Fallback: enumerate cameras and pick a back one (or any).
        const cams = await Html5Qrcode.getCameras().catch(() => []);
        if (!cams.length) throw firstErr;
        const back = cams.find((c) => /back|rear|environment/i.test(c.label)) ?? cams[cams.length - 1];
        await inst.start(back.id, CAMERA_CONFIG, onDecoded, onErr);
      }
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "";
      const raw = err instanceof Error ? err.message : String(err || "");
      let msg = "Camera unavailable.";
      if (name === "NotAllowedError" || /permission|notallowed|denied/i.test(raw)) {
        msg = "Permission denied. Allow camera in your browser settings, then tap Start again.";
      } else if (name === "NotFoundError" || /not found|no camera|notfound|devices? found/i.test(raw)) {
        msg = "No camera was found on this device.";
      } else if (name === "NotReadableError" || /in use|notreadable|could not start/i.test(raw)) {
        msg = "Camera is busy. Close other apps/tabs using it and try again.";
      } else if (inIframe) {
        msg = "Camera is blocked in this preview. Open the published link on your phone.";
      } else if (raw) {
        msg = raw;
      }
      toast.error(msg);
      try {
        await inst.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
      setScanning(false);
    }
  }

  async function stopScanner() {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      try {
        await inst.stop();
      } catch {
        /* ignore */
      }
      try {
        await inst.clear();
      } catch {
        /* ignore */
      }
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan QR Code</h1>
        <p className="text-muted-foreground text-sm">
          Point your camera at the activity's QR code to earn points.
        </p>
        {inIframe && (
          <p className="mt-2 text-xs text-amber-500">
            Tip: camera access is often blocked inside the preview. Open the app
            in a new tab or use the published link on your phone.
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        {scanning ? (
          <div
            id="qr-reader"
            className="w-full rounded-xl overflow-hidden bg-black/40"
          />
        ) : (
          <div className="w-full aspect-square rounded-xl overflow-hidden bg-black/40 flex items-center justify-center text-muted-foreground text-sm">
            Camera is off
          </div>
        )}
        <div className="mt-4 flex gap-2">
          {!scanning ? (
            <button
              onClick={startScanner}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-medium glow flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" /> Start camera
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex-1 glass rounded-xl py-3 font-medium flex items-center justify-center gap-2"
            >
              <CameraOff className="h-4 w-4" /> Stop
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Or enter code manually
        </div>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Activity code"
            className="flex-1 glass rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            disabled={busy}
            onClick={() => submitCode(manual.trim())}
            className="bg-primary text-primary-foreground rounded-xl px-4 text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </button>
        </div>
      </div>
    </div>
  );
}
