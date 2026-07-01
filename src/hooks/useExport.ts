"use client";

import { useCallback, useRef, useState } from "react";
import { toPng, toJpeg, toCanvas } from "html-to-image";
import { toast } from "sonner";

export type ExportFormat = "png" | "jpeg";

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

  const exportMp4 = useCallback(async (filename: string, onBeforeCapture?: () => void) => {
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

      // We capture as many frames as we can over ~3 seconds of real time.
      // Each toCanvas() call takes ~100-200ms, so we get ~15-30 frames.
      // Timestamps are based on wall-clock time so playback matches real speed.
      const captureMs = 3000; // record 3 seconds of real animation
      const totalFramesEstimate = 30; // rough estimate for progress

      // Ensure animation is playing
      if (onBeforeCapture) onBeforeCapture();
      await new Promise((r) => setTimeout(r, 150));

      // Warm up — first render primes fonts
      await toCanvas(el, { width, height, pixelRatio: 1, cacheBust: true });
      await new Promise((r) => setTimeout(r, 150));

      toast.info("Recording 3s of animation...");

      // Set up MP4 muxer
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: "avc",
          width,
          height,
        },
        fastStart: "in-memory",
      });

      // Set up VideoEncoder
      let encodedFrames = 0;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta ?? undefined);
          encodedFrames++;
        },
        error: (e) => console.error("Encoder error:", e),
      });

      encoder.configure({
        codec: "avc1.640028",
        width,
        height,
        bitrate: 8_000_000,
      });

      // Capture frames using wall-clock timestamps
      const startTime = performance.now();
      let frameIndex = 0;

      while (performance.now() - startTime < captureMs) {
        const frameStartMs = performance.now() - startTime;

        const canvas = await toCanvas(el, {
          width,
          height,
          pixelRatio: 1,
          cacheBust: true,
        });

        const frameEndMs = performance.now() - startTime;
        const timestampUs = Math.round(frameStartMs * 1000);
        const durationUs = Math.round((frameEndMs - frameStartMs) * 1000);

        const frame = new VideoFrame(canvas, {
          timestamp: timestampUs,
          duration: Math.max(durationUs, 33_000), // min ~30fps equivalent
        });

        const keyFrame = frameIndex % 10 === 0;
        encoder.encode(frame, { keyFrame });
        frame.close();

        frameIndex++;
        setVideoProgress(Math.round(((performance.now() - startTime) / captureMs) * 50));
      }

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

      const durationActual = ((performance.now() - startTime) / 1000).toFixed(1);
      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      toast.success(`MP4 exported — ${frameIndex} frames, ${sizeMB}MB`);
      setVideoProgress(100);
    } catch (error) {
      console.error("MP4 export failed:", error);
      toast.error("MP4 export failed");
    } finally {
      setIsExportingVideo(false);
      setVideoProgress(0);
    }
  }, []);

  return { exportRef, isExporting, isExportingVideo, videoProgress, exportImage, exportMp4 };
}
