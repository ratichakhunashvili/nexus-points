import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, CameraOff, KeyRound, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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

  async function startScanner() {
    setScanning(true);
    try {
      const inst = new Html5Qrcode("qr-reader");
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => submitCode(decoded),
        () => {},
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Camera unavailable");
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
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
      </div>

      <div className="glass rounded-2xl p-4">
        <div
          id="qr-reader"
          className="w-full aspect-square rounded-xl overflow-hidden bg-black/40 flex items-center justify-center"
        >
          {!scanning && (
            <div className="text-muted-foreground text-sm">Camera is off</div>
          )}
        </div>
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
