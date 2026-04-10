"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, Loader2, Send, RefreshCw, Pause, Play, Upload, ImagePlus, Paperclip, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { GlassCard } from "@/components/GlassCard";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { FormatPicker } from "@/components/FormatPicker";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { LogoUploader } from "@/components/LogoUploader";
import { OverlayPicker } from "@/components/OverlayPicker";
import { LogoPositionPicker } from "@/components/LogoPositionPicker";
import { ImagePlacer } from "@/components/ImagePlacer";
import type { CanvasImage } from "@/components/ImagePlacer";
import { ImageDragOverlay } from "@/components/ImageDragOverlay";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { DynamicTemplate } from "@/components/templates/DynamicTemplate";
import { useExport } from "@/hooks/useExport";
import { FORMAT_DIMENSIONS, DEFAULT_DESIGN } from "@/types/template";
import type { PlatformFormat, DesignConfig, CollageLayout } from "@/types/template";
import { FeedbackButton } from "@/components/FeedbackButton";
import { compressImage } from "@/lib/utils";

interface ChatAttachment {
  id: string;
  dataUrl: string;
  thumbnail: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  logoSuggestions?: string[];
  photoSuggestions?: string[];
  usePhotoSuggestions?: number[];
}

// Collage layout position presets
type LayoutPosition = { x: number; y: number; width: number; height: number };
const COLLAGE_LAYOUTS: Record<CollageLayout, (count: number) => LayoutPosition[]> = {
  single: () => [{ x: 0.5, y: 0.5, width: 0.35, height: 0.35 }],
  "side-by-side": () => [
    { x: 0.3, y: 0.5, width: 0.28, height: 0.4 },
    { x: 0.7, y: 0.5, width: 0.28, height: 0.4 },
  ],
  "grid-2x2": () => [
    { x: 0.3, y: 0.35, width: 0.25, height: 0.25 },
    { x: 0.7, y: 0.35, width: 0.25, height: 0.25 },
    { x: 0.3, y: 0.65, width: 0.25, height: 0.25 },
    { x: 0.7, y: 0.65, width: 0.25, height: 0.25 },
  ],
  "top-bottom": () => [
    { x: 0.5, y: 0.3, width: 0.4, height: 0.25 },
    { x: 0.5, y: 0.7, width: 0.4, height: 0.25 },
  ],
  "hero-with-thumbnails": () => [
    { x: 0.5, y: 0.35, width: 0.5, height: 0.4 },
    { x: 0.25, y: 0.78, width: 0.15, height: 0.15 },
    { x: 0.5, y: 0.78, width: 0.15, height: 0.15 },
    { x: 0.75, y: 0.78, width: 0.15, height: 0.15 },
  ],
};

// Build API messages with multimodal support for vision
function buildApiMessages(messages: Message[], maxImageMessages = 2) {
  // Find which messages have images — only keep images from last N
  const imageMessageIndices: number[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].attachments?.length) {
      imageMessageIndices.push(i);
      if (imageMessageIndices.length >= maxImageMessages) break;
    }
  }

  return messages.map((msg, idx) => {
    const hasImages = msg.attachments?.length && imageMessageIndices.includes(idx);
    if (!hasImages) {
      return { role: msg.role, content: msg.content };
    }
    return {
      role: msg.role,
      content: [
        ...msg.attachments!.map((att) => ({
          type: "image_url" as const,
          image_url: { url: att.thumbnail },
        })),
        {
          type: "text" as const,
          text: msg.content || `[User uploaded ${msg.attachments!.length} reference image(s)]`,
        },
      ],
    };
  });
}

export default function Home() {
  const [format, setFormat] = useState<PlatformFormat>("instagram");
  const [customSize, setCustomSize] = useState({ width: 1080, height: 1080 });
  const [design, setDesign] = useState<DesignConfig>(DEFAULT_DESIGN);
  const [partnerLogo, setPartnerLogo] = useState<string | null>(null);
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [bgPaused, setBgPaused] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);

  const { exportRef, isExporting, isExportingVideo, videoProgress, exportImage, exportMp4 } = useExport();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(0.4);

  const dims = format === "custom"
    ? { width: customSize.width, height: customSize.height, label: `Custom (${customSize.width}×${customSize.height})` }
    : FORMAT_DIMENSIONS[format];

  // Canvas image helpers
  const addCanvasImage = useCallback((img: CanvasImage) => {
    setCanvasImages((prev) => [...prev, img]);
    setSelectedImageId(img.id);
  }, []);

  const updateCanvasImage = useCallback((id: string, patch: Partial<CanvasImage>) => {
    setCanvasImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }, []);

  const removeCanvasImage = useCallback((id: string) => {
    setCanvasImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedImageId((prev) => (prev === id ? null : prev));
  }, []);

  const calculateScale = useCallback(() => {
    if (!previewContainerRef.current) return;
    const container = previewContainerRef.current;
    const padding = 40;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scaleX = availW / dims.width;
    const scaleY = availH / dims.height;
    setScale(Math.min(scaleX, scaleY, 1));
  }, [dims.width, dims.height]);

  useEffect(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [calculateScale]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle chat file attachments
  const handleChatFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const remaining = 4 - chatAttachments.length;
    const toProcess = fileArray.slice(0, remaining);

    for (const file of toProcess) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} too large (max 10MB)`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const thumbnail = await compressImage(dataUrl);
      setChatAttachments((prev) => {
        if (prev.length >= 4) return prev;
        return [...prev, { id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dataUrl, thumbnail }];
      });
    }
  }, [chatAttachments.length]);

  const removeChatAttachment = useCallback((id: string) => {
    setChatAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Handle USE_PHOTO suggestions from AI response
  const handleUsePhotos = useCallback((usePhotoSuggestions: number[], collageLayout: CollageLayout | undefined, allMessages: Message[]) => {
    // Find most recent user message with attachments
    const lastWithAttachments = [...allMessages].reverse().find((m) => m.role === "user" && m.attachments?.length);
    if (!lastWithAttachments?.attachments) return;

    const layout = collageLayout || "single";
    const positions = COLLAGE_LAYOUTS[layout](usePhotoSuggestions.length);

    const newImages: CanvasImage[] = usePhotoSuggestions
      .filter((idx) => idx < lastWithAttachments.attachments!.length)
      .map((idx, i) => ({
        id: `img-${Date.now()}-${i}`,
        src: lastWithAttachments.attachments![idx].dataUrl,
        ...(positions[i] || positions[0]),
        shape: "rounded" as const,
        border: true,
      }));

    if (newImages.length > 0) {
      setCanvasImages(newImages);
      setSelectedImageId(newImages[0].id);
      toast.success(`${newImages.length} photo${newImages.length > 1 ? "s" : ""} placed on canvas`);
    }
  }, []);

  const handleGenerate = async () => {
    if ((!prompt.trim() && chatAttachments.length === 0) || isGenerating) return;

    const userMessage: Message = {
      role: "user",
      content: prompt.trim(),
      attachments: chatAttachments.length > 0 ? [...chatAttachments] : undefined,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setPrompt("");
    setChatAttachments([]);
    setIsGenerating(true);

    try {
      const apiMessages = buildApiMessages(updatedMessages);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
      } else if (data.chatOnly) {
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: data.note },
        ]);
      } else {
        setDesign(data.design);
        const content = data.note || `Design updated: "${data.design.headline.replace(/\n/g, " / ")}"`;
        const assistantMsg: Message = {
          role: "assistant",
          content,
          logoSuggestions: data.logoSuggestions,
          photoSuggestions: data.photoSuggestions,
          usePhotoSuggestions: data.usePhotoSuggestions,
        };
        setMessages([...updatedMessages, assistantMsg]);

        // Handle USE_PHOTO suggestions
        if (data.usePhotoSuggestions?.length) {
          handleUsePhotos(data.usePhotoSuggestions, data.design.collageLayout, updatedMessages);
        }
      }
    } catch {
      toast.error("Failed to generate — check your connection");
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Failed to generate. Check your connection." },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (isGenerating || messages.length === 0) return;

    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;

    const actualIdx = messages.length - 1 - lastUserIdx;
    const messagesUpToLastUser = messages.slice(0, actualIdx + 1);

    const prevDesignSummary = `Previous design used: bg=${design.backgroundId}, alignment=${design.alignment}, textPosition=${design.textPosition}, glassCard=${design.showGlassCard ?? false}, scale=${design.headlineScale}, headline="${design.headline}"`;
    const regenMessages: Message[] = [
      ...messagesUpToLastUser,
      {
        role: "user",
        content: `[REGENERATE — make a DIFFERENT design. Change the background, layout, positioning, and text treatment. ${prevDesignSummary}. Pick a different background, different alignment, different mode (glass card vs direct). Make it feel fresh.]`,
      },
    ];

    setIsGenerating(true);

    try {
      const apiMessages = buildApiMessages(regenMessages);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...messagesUpToLastUser,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
      } else if (data.chatOnly) {
        setMessages([
          ...messagesUpToLastUser,
          { role: "assistant", content: data.note },
        ]);
      } else {
        setDesign(data.design);
        const content = data.note || `Regenerated: "${data.design.headline.replace(/\n/g, " / ")}"`;
        const assistantMsg: Message = {
          role: "assistant",
          content,
          logoSuggestions: data.logoSuggestions,
          photoSuggestions: data.photoSuggestions,
          usePhotoSuggestions: data.usePhotoSuggestions,
        };
        setMessages([...messagesUpToLastUser, assistantMsg]);

        if (data.usePhotoSuggestions?.length) {
          handleUsePhotos(data.usePhotoSuggestions, data.design.collageLayout, messagesUpToLastUser);
        }
      }
    } catch {
      setMessages([
        ...messagesUpToLastUser,
        { role: "assistant", content: "Failed to regenerate. Check your connection." },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    setBgPaused(true);
    setTimeout(() => {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `techbbq-visual-${format}-${dims.width}x${dims.height}-${date}.png`;
      exportImage(filename);
    }, 100);
  };

  const handleExportMp4 = () => {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `techbbq-visual-${format}-${dims.width}x${dims.height}-${date}.mp4`;
    exportMp4(filename, () => setBgPaused(false));
  };

  return (
    <div className="min-h-screen relative">
      <AnimatedGradient />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <div className="px-8 py-5 flex items-center gap-4">
          <img src="/TechBBQ Logo Red.png" alt="TechBBQ" className="h-8" />
          <div>
            <h1 className="text-lg font-semibold">Visual Generator</h1>
            <p className="text-xs text-white/50">Describe your visual — AI builds it</p>
          </div>
          <div className="ml-auto">
            <FeedbackButton />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex min-h-0 px-6 pb-6 gap-6">
          {/* Left: Chat + controls */}
          <div className="w-[400px] shrink-0 flex flex-col gap-3 max-h-full">
            {/* Chat / Prompt — PRIMARY element */}
            <GlassCard className="flex-1 min-h-0 p-4 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto mb-3 space-y-3">
                {messages.length === 0 && (
                  <div className="text-white/30 text-sm py-8 text-center">
                    <p className="mb-2">Chat with the AI creative director.</p>
                    <p className="text-xs">Try:</p>
                    <p className="text-xs text-white/20 mt-1">&quot;I need a visual for our event next week&quot;</p>
                    <p className="text-xs text-white/20">&quot;Speaker announcement for TechBBQ 2026&quot;</p>
                    <p className="text-xs text-white/20">Or attach reference images and say &quot;Create something like this&quot;</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i}>
                    {/* Attachment thumbnails on user messages */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex gap-1.5 ml-8 mb-1">
                        {msg.attachments.map((att) => (
                          <img
                            key={att.id}
                            src={att.dataUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-white/10"
                          />
                        ))}
                      </div>
                    )}
                    <div
                      className={`text-sm rounded-lg px-3 py-2 whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-white/10 text-white/90 ml-8"
                          : "bg-[#FF0028]/10 text-white/70 mr-8 border border-[#FF0028]/20"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {/* Inline logo upload when AI suggests it */}
                    {msg.logoSuggestions && msg.logoSuggestions.length > 0 && !partnerLogo && (
                      <div className="mr-8 mt-1.5">
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-dashed border-white/20 hover:border-[#FF6B00]/40 hover:bg-white/10 cursor-pointer transition-colors text-xs text-white/50 hover:text-white/70">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload {msg.logoSuggestions[0]} logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setPartnerLogo(ev.target?.result as string);
                                toast.success("Partner logo uploaded");
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {msg.logoSuggestions && msg.logoSuggestions.length > 0 && partnerLogo && (
                      <div className="mr-8 mt-1.5 flex items-center gap-2 px-3 py-1.5 text-xs text-[#FF6B00]/70">
                        Partner logo uploaded
                      </div>
                    )}
                    {/* Inline photo upload when AI suggests it */}
                    {msg.photoSuggestions && msg.photoSuggestions.length > 0 && canvasImages.length === 0 && (
                      <div className="mr-8 mt-1.5">
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-dashed border-white/20 hover:border-[#FF6B00]/40 hover:bg-white/10 cursor-pointer transition-colors text-xs text-white/50 hover:text-white/70">
                          <ImagePlus className="w-3.5 h-3.5" />
                          <span>Upload {msg.photoSuggestions[0]}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const src = ev.target?.result as string;
                                const img = new Image();
                                img.onload = () => {
                                  const aspect = img.width / img.height;
                                  const w = 0.35;
                                  const h = w / aspect;
                                  addCanvasImage({
                                    id: `img-${Date.now()}`,
                                    src,
                                    x: 0.5,
                                    y: 0.5,
                                    width: Math.min(w, 0.9),
                                    height: Math.min(h, 0.9),
                                    shape: "rounded",
                                    border: false,
                                  });
                                  toast.success("Photo added to canvas");
                                };
                                img.src = src;
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {msg.photoSuggestions && msg.photoSuggestions.length > 0 && canvasImages.length > 0 && (
                      <div className="mr-8 mt-1.5 flex items-center gap-2 px-3 py-1.5 text-xs text-[#FF6B00]/70">
                        Photo added — drag to reposition on the preview
                      </div>
                    )}
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-white/40 px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Designing...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input area */}
              <div className="shrink-0 flex flex-col gap-2">
                {/* Attachment thumbnail strip */}
                {chatAttachments.length > 0 && (
                  <div className="flex gap-1.5 px-1">
                    {chatAttachments.map((att) => (
                      <div key={att.id} className="relative group">
                        <img
                          src={att.dataUrl}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover border border-white/10"
                        />
                        <button
                          onClick={() => removeChatAttachment(att.id)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 border border-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5 text-white/70" />
                        </button>
                      </div>
                    ))}
                    {chatAttachments.length >= 4 && (
                      <span className="text-[10px] text-white/30 self-center ml-1">Max 4</span>
                    )}
                  </div>
                )}

                {/* Input row */}
                <div
                  className="flex gap-2"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files.length) handleChatFiles(e.dataTransfer.files);
                  }}
                >
                  <button
                    onClick={() => chatFileRef.current?.click()}
                    disabled={chatAttachments.length >= 4}
                    title="Attach reference images"
                    className="self-end px-2 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 shrink-0 border border-white/10"
                  >
                    <Paperclip className="w-4 h-4 text-white/50" />
                  </button>
                  <input
                    ref={chatFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleChatFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder={chatAttachments.length > 0 ? "Describe what you want with these images..." : "Describe the visual you want..."}
                    rows={2}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#f2f2f2] placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors resize-none"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={(!prompt.trim() && chatAttachments.length === 0) || isGenerating}
                    className="self-end px-3 py-2 bg-[#FF0028] hover:bg-[#E00224] rounded-lg transition-colors disabled:opacity-30 shrink-0"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isGenerating || messages.length === 0}
                    title="Regenerate last design"
                    className="self-end px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30 shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Settings — collapsible, secondary */}
            <GlassCard className="p-3 flex flex-col gap-1.5 overflow-y-auto max-h-[30vh]">
              {/* Format — always visible */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider shrink-0">Format</span>
                <FormatPicker
                  value={format}
                  onChange={setFormat}
                  customWidth={customSize.width}
                  customHeight={customSize.height}
                  onCustomSizeChange={(w, h) => setCustomSize({ width: w, height: h })}
                />
              </div>

              <div className="border-t border-white/5 my-1" />

              <CollapsibleSection label="Background" defaultOpen>
                <BackgroundPicker
                  value={design.backgroundId}
                  onChange={(id) => setDesign({ ...design, backgroundId: id })}
                />
                <div className="mt-2">
                  <button
                    onClick={() => setBgPaused(!bgPaused)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      bgPaused
                        ? "bg-[#FF0028]/20 text-[#FF6B00] border border-[#FF0028]/30"
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {bgPaused ? (
                      <><Play className="w-3 h-3" /> Paused</>
                    ) : (
                      <><Pause className="w-3 h-3" /> Pause frame</>
                    )}
                  </button>
                </div>
              </CollapsibleSection>

              <div className="relative">
                <div className="opacity-30 pointer-events-none select-none">
                  <CollapsibleSection label="Templates">
                    <TemplatesPanel currentDesign={design} onApply={setDesign} />
                  </CollapsibleSection>

                  <CollapsibleSection label="TechBBQ Logo">
                    <LogoPositionPicker
                      show={design.showLogo ?? false}
                      position={design.logoPosition || "bottom-center"}
                      logoStyle={design.logoStyle || "red"}
                      onShowChange={(s) => setDesign((prev) => ({ ...prev, showLogo: s }))}
                      onPositionChange={(p) => setDesign((prev) => ({ ...prev, showLogo: true, logoPosition: p }))}
                      onStyleChange={(s) => setDesign((prev) => ({ ...prev, logoStyle: s }))}
                    />
                  </CollapsibleSection>

                  <CollapsibleSection label="Partner Logo">
                    <LogoUploader value={partnerLogo} onChange={setPartnerLogo} />
                  </CollapsibleSection>

                  <CollapsibleSection label="Photos / Images">
                    <ImagePlacer
                      images={canvasImages}
                      selectedId={selectedImageId}
                      onAdd={addCanvasImage}
                      onUpdate={updateCanvasImage}
                      onRemove={removeCanvasImage}
                      onSelect={setSelectedImageId}
                    />
                  </CollapsibleSection>

                  <CollapsibleSection label="Color Overlay">
                    <OverlayPicker
                      color={design.overlayColor}
                      opacity={design.overlayOpacity ?? 0}
                      blend={design.overlayBlend || "multiply"}
                      onColorChange={(c) => setDesign({ ...design, overlayColor: c })}
                      onOpacityChange={(o) => setDesign({ ...design, overlayOpacity: o })}
                      onBlendChange={(b) => setDesign({ ...design, overlayBlend: b })}
                    />
                  </CollapsibleSection>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider bg-black/40 px-3 py-1.5 rounded-lg">Coming soon</span>
                </div>
              </div>
            </GlassCard>

            {/* Export */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleExport}
                disabled={isExporting || isExportingVideo}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#FF0028] hover:bg-[#E00224] active:bg-[#C00120] text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    PNG
                  </>
                )}
              </button>
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 text-white/30 text-sm font-medium py-2 px-3 rounded-lg border border-white/5 cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                MP4
                <span className="text-[10px] uppercase tracking-wider opacity-60">Soon</span>
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div
            ref={previewContainerRef}
            className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-white/5 border border-white/10"
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "center center",
              }}
            >
              <div style={{ position: "relative", width: dims.width, height: dims.height }}>
                <div ref={exportRef}>
                  <DynamicTemplate
                    design={design}
                    format={format}
                    partnerLogo={partnerLogo}
                    canvasImages={canvasImages}
                    paused={bgPaused}
                  />
                </div>
                {/* Drag overlays — one per canvas image, outside exportRef */}
                {canvasImages.map((img) => (
                  <ImageDragOverlay
                    key={img.id}
                    image={img}
                    otherImages={canvasImages.filter((ci) => ci.id !== img.id)}
                    canvasWidth={dims.width}
                    canvasHeight={dims.height}
                    selected={selectedImageId === img.id}
                    onSelect={() => setSelectedImageId(img.id)}
                    onDeselect={() => setSelectedImageId(null)}
                    onChange={(updated) => setCanvasImages((prev) =>
                      prev.map((ci) => (ci.id === updated.id ? updated : ci))
                    )}
                    onDelete={() => removeCanvasImage(img.id)}
                    onDuplicate={() => {
                      const dup: CanvasImage = {
                        ...img,
                        id: `img-${Date.now()}`,
                        x: Math.min(img.x + 0.05, 1),
                        y: Math.min(img.y + 0.05, 1),
                      };
                      addCanvasImage(dup);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
