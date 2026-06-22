import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, CameraOff, KeyRound, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/scan")({
  component: ScanPage,
});

function getCameraErrorMessage(err: unknown, inIframe: boolean) {
  const name = (err as { name?: string })?.name ?? "";
  const raw = err instanceof Error ? err.message : String(err || "");

  if (name === "NotAllowedError" || /permission|notallowed|denied/i.test(raw)) {
    return "Permission denied. Allow camera in your browser settings, then tap Start again.";
  }
  if (name === "NotFoundError" || /not found|no camera|notfound|devices? found/i.test(raw)) {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || /in use|notreadable|could not start/i.test(raw)) {
    return "Camera is busy. Close other apps/tabs using it and try again.";
  }
  if (inIframe) {
    return "Camera is blocked in this preview. Open the published link on your phone.";
  }
  return raw || "Camera unavailable.";
}

function ScanPage() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastCodeRef = useRef<string>("");

  async function submitCode(raw: string) {
    if (!raw || busy) return;
    // Accept both raw tokens and URL-encoded QR codes like /scan?code=TOKEN
    let code = raw.trim();
    try {
      if (code.startsWith("http://") || code.startsWith("https://")) {
        const u = new URL(code);
        const fromQuery = u.searchParams.get("code");
        if (fromQuery) code = fromQuery;
      }
    } catch {
      /* ignore — use raw */
    }
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

  const inIframe = (() => {
    try {
      return typeof window !== "undefined" && window.self !== window.top;
    } catch {
      return true;
    }
  })();

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!video || !canvas || !stream) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width > 0 && height > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        const image = ctx.getImageData(0, 0, width, height);
        const result = jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" });
        if (result?.data) submitCode(result.data);
      }
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  }

  async function startScanner() {
    if (streamRef.current || starting) return;
    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      toast.error("Camera requires HTTPS. Open the published link.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support camera access.");
      return;
    }

    setStarting(true);
    setScanning(true);

    const streamRequest = navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    try {
      let stream: MediaStream;
      try {
        stream = await streamRequest;
      } catch (firstErr) {
        if (/overconstrained|constraint/i.test(String(firstErr))) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } else {
          throw firstErr;
        }
      }

      const video = videoRef.current;
      if (!video) throw new Error("Camera view is not ready. Try again.");

      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();

      frameRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      toast.error(getCameraErrorMessage(err, inIframe));
      setScanning(false);
    } finally {
      setStarting(false);
    }
  }

  function stopScanner() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setStarting(false);
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
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/40 flex items-center justify-center text-muted-foreground text-sm">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 h-full w-full object-cover ${scanning ? "opacity-100" : "opacity-0"}`}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!scanning ? (
            <span>Camera is off</span>
          ) : starting ? (
            <span className="relative z-10 flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening camera
            </span>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-56 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_999px_rgb(0_0_0_/_0.25)]" />
            </div>
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
              disabled={starting}
              className="flex-1 glass rounded-xl py-3 font-medium flex items-center justify-center gap-2"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CameraOff className="h-4 w-4" />} Stop
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
