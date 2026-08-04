"use client";

import { useCallback, useRef, useState } from "react";
import { toPng, toJpeg, toCanvas } from "html-to-image";
import { toast } from "sonner";

export type ExportFormat = "png" | "jpeg";

/**
 * Video length bounds, shared with the pickers so the UI can't offer something
 * the recorder then clamps away. Under a second isn't a video; past a minute the
 * in-memory muxer buffer and the real-time wait stop being reasonable (a 60s
 * capture is 1800 frames and takes a full minute of watching).
 */
export const VIDEO_MIN_SECONDS = 1;
export const VIDEO_MAX_SECONDS = 60;
/** The lengths worth one click. Anything else goes in the number field. */
export const VIDEO_PRESETS = [3, 10, 15, 30, 60] as const;

/**
 * H.264 limits the picture size per LEVEL, and the level is baked into the
 * codec string. The original hardcoded `avc1.640028` is High/level 4.0, which
 * caps at 2,097,152 coded pixels — so a 1500×1500 square export ALWAYS died
 * with `NotSupportedError` (16:9 and 9:16 both sit at 2,073,600 and squeezed
 * under). Ask the browser which of these it will actually take, highest level
 * first, instead of assuming.
 */
const AVC_CANDIDATES = [
  "avc1.640034", // High 5.2
  "avc1.640033", // High 5.1
  "avc1.640032", // High 5.0
  "avc1.4d0034", // Main 5.2
  "avc1.4d0033", // Main 5.1
  "avc1.640028", // High 4.0 — the old hardcoded value, last resort
];

const BITRATE = 6_000_000;

/**
 * Video frames are capped at Full-HD's pixel count. Measured in Chrome: a
 * 1500×1500 frame at 30fps CRASHED the renderer, while 1440×1440, 1920×1080
 * and 1080×1920 (all ≤ 2,073,600 px) encoded 3 seconds cleanly. So the three
 * canvas formats record at 1440×1440 / 1920×1080 / 1080×1920 — still 1080p+
 * and above what LinkedIn and Instagram keep after their own re-encode, while
 * the STILL export keeps the full canvas resolution at 2× supersampling.
 */
const MAX_VIDEO_PIXELS = 1920 * 1080;

/** Frame size for a w×h canvas: aspect kept, pixel-capped, dimensions even
 *  (H.264 cannot encode an odd width or height). */
function videoFrameSize(w: number, h: number): { width: number; height: number } {
  const scale = Math.min(1, Math.sqrt(MAX_VIDEO_PIXELS / (w * h)));
  return { width: 2 * Math.round((w * scale) / 2), height: 2 * Math.round((h * scale) / 2) };
}

/**
 * The live background element (shader canvas, orb canvas, or static image),
 * found via the `data-canvas-bg` wrapper DynamicTemplate puts around it.
 */
function findBackgroundLayer(el: HTMLElement): { host: HTMLElement; src: HTMLCanvasElement | HTMLImageElement } | null {
  const host = el.querySelector<HTMLElement>("[data-canvas-bg]");
  const src = host?.querySelector<HTMLCanvasElement | HTMLImageElement>("canvas, img");
  return host && src ? { host, src } : null;
}

/** Can we actually read pixels out of it? A WebGL canvas without
 *  `preserveDrawingBuffer` draws as transparent black, which would make the
 *  whole video a black background — fall back to the slow path if so. */
function canReadPixels(src: CanvasImageSource): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 4;
    probe.height = 4;
    const ctx = probe.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(src, 0, 0, 4, 4);
    const { data } = ctx.getImageData(0, 0, 4, 4);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
  } catch {
    return false;
  }
}

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/** First codec string this browser can encode at w×h, or null if none can. */
async function pickAvcCodec(w: number, h: number): Promise<string | null> {
  for (const codec of AVC_CANDIDATES) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: BITRATE });
      if (supported) return codec;
    } catch { /* malformed for this browser — try the next */ }
  }
  return null;
}

export function useExport() {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const exportImage = useCallback(async (filename: string, format: ExportFormat = "png") => {
    if (!exportRef.current) return;
    setIsExporting(true);

    try {
      await document.fonts.ready;

      const opts = {
        width: exportRef.current.offsetWidth,
        height: exportRef.current.offsetHeight,
        // 2x supersample — the condensed TechBBQ wordmark and text edges need
        // more pixels than the 1:1 design size to render crisply (a 1080px
        // export makes the logo's thin strokes anti-alias to grey/blurry).
        // Output is 2x the design dimensions, e.g. a 1080² canvas -> 2160².
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: false,
        // JPEG has no alpha — flatten onto warm-black so transparent corners
        // (e.g. behind the canvas-rounded preview) don't render as pure black.
        backgroundColor: format === "jpeg" ? "#15110e" : undefined,
        quality: 0.95,
      };

      const render = format === "jpeg" ? toJpeg : toPng;

      // Double-render trick: first pass forces font loading into the canvas,
      // second pass captures with fonts properly rendered
      await render(exportRef.current, opts);
      await new Promise((r) => setTimeout(r, 200));
      const dataUrl = await render(exportRef.current, opts);

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast.success(`${format === "jpeg" ? "JPG" : "PNG"} exported`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed — try pausing the background first");
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Record the animated background as an MP4.
   *
   * `seconds` is how long to capture, clamped to VIDEO_MIN/MAX_SECONDS. Cost
   * scales linearly and nothing else changes: 30s is 900 frames and lands around
   * 22MB at this bitrate, which the in-memory muxer holds without complaint.
   *
   * It IS real time, though — the canvas has to keep animating on screen
   * throughout, so the tab cannot be backgrounded (Chrome suspends
   * requestAnimationFrame there). A hidden tab pauses the capture rather than
   * corrupting it; see `waitVisible`.
   */
  const exportMp4 = useCallback(async (filename: string, onBeforeCapture?: () => void, seconds = 3) => {
    if (!exportRef.current) return;

    // Check browser support
    if (typeof VideoEncoder === "undefined") {
      toast.error("MP4 export requires Chrome or Edge (VideoEncoder API not supported)");
      return;
    }

    setIsExportingVideo(true);
    setVideoProgress(0);

    try {
      const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

      await document.fonts.ready;

      const el = exportRef.current;
      const width = el.offsetWidth;
      const height = el.offsetHeight;

      // Frame size first (pixel-capped, see videoFrameSize), then ask the
      // browser which AVC level it will take at that size. If even that is
      // refused, halve it rather than failing outright.
      let { width: outW, height: outH } = videoFrameSize(width, height);
      let codec = await pickAvcCodec(outW, outH);
      if (!codec) {
        outW = 2 * Math.round(outW / 4);
        outH = 2 * Math.round(outH / 4);
        codec = await pickAvcCodec(outW, outH);
        if (codec) toast.info(`Recording at ${outW}×${outH} — this browser can't encode a bigger frame`);
      }
      if (!codec) {
        toast.error("This browser can't encode an MP4 at this canvas size");
        return;
      }

      const captureSeconds = Math.min(VIDEO_MAX_SECONDS, Math.max(VIDEO_MIN_SECONDS, Math.round(seconds)));
      const FPS = 30;
      const frameMs = 1000 / FPS;

      // Ensure animation is playing
      if (onBeforeCapture) onBeforeCapture();
      await new Promise((r) => setTimeout(r, 150));

      // Warm up — first render primes fonts
      await toCanvas(el, { width, height, pixelRatio: 1, cacheBust: true, canvasWidth: outW, canvasHeight: outH });
      await new Promise((r) => setTimeout(r, 150));

      // ── Pick the capture strategy ────────────────────────────────────────
      // FAST (composited): rasterize the static content ONCE with the
      // background layer hidden, then per frame just draw the live background
      // canvas + that overlay. Two drawImage calls per frame instead of a full
      // DOM serialization, which is what held the video to ~5fps and made it
      // look like a slideshow next to the preview.
      const bg = findBackgroundLayer(el);
      let overlay: HTMLCanvasElement | null = null;
      if (bg && canReadPixels(bg.src)) {
        // The canvas root paints an opaque base colour, so it has to go
        // transparent too — otherwise the overlay would hide the background.
        const root = bg.host.parentElement as HTMLElement | null;
        const prevVisibility = bg.host.style.visibility;
        const prevRootBg = root?.style.background ?? "";
        bg.host.style.visibility = "hidden";
        if (root) root.style.background = "transparent";
        try {
          overlay = await toCanvas(el, {
            width, height, pixelRatio: 1, cacheBust: true,
            canvasWidth: outW, canvasHeight: outH,
          });
        } finally {
          bg.host.style.visibility = prevVisibility;
          if (root) root.style.background = prevRootBg;
        }
      }

      toast.info(overlay
        ? `Recording ${captureSeconds}s at 30fps — keep this tab in front…`
        : `Recording ${captureSeconds}s of animation…`);

      // Set up MP4 muxer
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: "avc",
          width: outW,
          height: outH,
          frameRate: FPS,
        },
        fastStart: "in-memory",
        // Frame timestamps are wall-clock, so the first one lands a few ms in
        // (the capture loop waits for a requestAnimationFrame tick) — the muxer
        // rejects every chunk unless it's told to rebase them to zero.
        firstTimestampBehavior: "offset",
      });

      // Set up VideoEncoder
      let encodedFrames = 0;
      // The codec closes itself on error, so remember the failure and stop
      // instead of calling encode() on a dead encoder for the rest of the loop.
      let encoderError: unknown = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta ?? undefined);
          encodedFrames++;
        },
        error: (e) => { encoderError = e; },
      });

      encoder.configure({
        codec,
        width: outW,
        height: outH,
        bitrate: BITRATE,
        framerate: FPS,
        latencyMode: "quality",
      });

      // The loop counts FRAMES, not wall-clock seconds. Wall-clock silently
      // truncated the video whenever the tab lost focus: Chrome suspends
      // requestAnimationFrame in a background tab while performance.now() keeps
      // running, so a 30s recording came back as a 4s clip with no error. Now a
      // hidden tab just pauses the capture (see waitVisible) and the output is
      // always exactly the length that was asked for.
      const totalFrames = captureSeconds * FPS;
      let frameIndex = 0;
      // Accumulated VISIBLE time, used to pace sampling of the animation. Reset
      // across a hidden stretch so the pause doesn't eat the schedule.
      let scheduleStart = performance.now();
      const elapsedVisible = () => performance.now() - scheduleStart;

      /** Park until the tab is in front again, then rebase the pacing clock.
       *  Throws after 90s rather than quietly finishing short: a 30s recording
       *  that came back 4s long with a success toast is worse than an error. */
      const waitVisible = async (): Promise<boolean> => {
        if (!document.hidden) return true;
        const deadline = performance.now() + 90_000;
        while (document.hidden) {
          if (performance.now() > deadline) {
            throw new Error("recording paused too long in a background tab — keep this tab in front while it records");
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        // Skip the gap: the next frame is due immediately, not "however long you
        // were away" ago.
        scheduleStart = performance.now() - frameIndex * frameMs;
        return true;
      };

      // close() in `finally` throughout: a throwing encode() used to leak the
      // frame ("A VideoFrame was garbage collected without being closed").
      const frameDurationUs = Math.round(1_000_000 / FPS);
      const encodeFrame = (source: CanvasImageSource) => {
        const frame = new VideoFrame(source, {
          // Uniform, not wall-clock: constant spacing is what makes playback
          // read as smooth (see the note above encodeFrame's callers).
          timestamp: frameIndex * frameDurationUs,
          duration: frameDurationUs,
        });
        try {
          encoder.encode(frame, { keyFrame: frameIndex % FPS === 0 });
        } finally {
          frame.close();
        }
        frameIndex++;
        setVideoProgress(Math.round((frameIndex / totalFrames) * 50));
      };

      if (overlay && bg) {
        // Composite at a steady 30fps, advancing with requestAnimationFrame so
        // the shader actually moves between frames.
        const comp = document.createElement("canvas");
        comp.width = outW;
        comp.height = outH;
        const cctx = comp.getContext("2d", { alpha: false });
        if (!cctx) throw new Error("no 2d context for compositing");
        while (frameIndex < totalFrames) {
          if (encoderError || encoder.state !== "configured") break;
          if (!(await waitVisible())) break;
          await nextFrame();
          // ABSOLUTE schedule: frame n is due at n/FPS from the start. The
          // obvious "due = now + interval" accumulates drift, so with 60Hz
          // animation frames a 33ms target kept landing on the 50ms tick and
          // ~8% of slots were skipped — the motion was then sampled unevenly
          // and played back evenly, which still read as judder. Measured:
          // this fills 90/90 slots where the drifting version filled 83.
          if (elapsedVisible() + 1 < frameIndex * frameMs) continue;
          // Keep the encoder from queueing a backlog we'd only wait on later.
          // Cap 8 measured as the point where waits drop to zero at 30fps.
          while (encoder.encodeQueueSize > 8 && !encoderError) await nextFrame();
          cctx.drawImage(bg.src, 0, 0, outW, outH);
          cctx.drawImage(overlay, 0, 0, outW, outH);
          encodeFrame(comp);
        }
      } else {
        // Fallback: no readable background layer (an unreadable WebGL context,
        // or a doc without the tagged wrapper) — rasterize per frame. Slow, so
        // the result is choppy, but it still produces a correct video.
        while (frameIndex < totalFrames) {
          if (encoderError || encoder.state !== "configured") break;
          if (!(await waitVisible())) break;
          const canvas = await toCanvas(el, {
            width, height, pixelRatio: 1, cacheBust: true,
            canvasWidth: outW, canvasHeight: outH,
          });
          encodeFrame(canvas);
        }
      }
      if (encoderError) throw encoderError;
      if (frameIndex === 0) throw new Error("no frames captured");

      // Flush and finalize
      toast.info(`Encoding ${frameIndex} frames...`);
      setVideoProgress(55);
      await encoder.flush();
      encoder.close();
      muxer.finalize();

      setVideoProgress(98);

      const blob = new Blob([target.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      toast.success(`MP4 exported — ${frameIndex} frames at ${FPS}fps, ${(frameIndex / FPS).toFixed(1)}s, ${sizeMB}MB`);
      setVideoProgress(100);
    } catch (error) {
      console.error("MP4 export failed:", error);
      const reason = error instanceof Error ? error.message : String(error);
      toast.error(`MP4 export failed — ${reason}`);
    } finally {
      setIsExportingVideo(false);
      setVideoProgress(0);
    }
  }, []);

  return { exportRef, isExporting, isExportingVideo, videoProgress, exportImage, exportMp4 };
}
