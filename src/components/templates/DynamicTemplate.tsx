"use client";

import type { DesignConfig, PlatformFormat } from "@/types/template";
import { FORMAT_DIMENSIONS } from "@/types/template";
import { COLORS, FONTS, GRADIENT_TEXT_CSS, GRADIENT_BORDER_CSS } from "@/lib/constants";
import { LiquidMetalBg } from "@/components/LiquidMetalBg";
import type { CanvasImage } from "@/components/ImagePlacer";

interface DynamicTemplateProps {
  design: DesignConfig;
  format: PlatformFormat;
  partnerLogo?: string | null;
  canvasImages?: CanvasImage[];
  paused?: boolean;
}

export function DynamicTemplate({ design, format, partnerLogo, canvasImages, paused }: DynamicTemplateProps) {
  const dims = FORMAT_DIMENSIONS[format];
  const isSquare = format === "instagram";

  const hasHeadline = !!design.headline?.trim();
  const headlineLines = hasHeadline ? design.headline.split("\n") : [];
  // Bigger base sizes — text should dominate the frame
  const baseFontSize = isSquare ? 96 : 84;
  const rawHeadlineFontSize = Math.round(baseFontSize * (design.headlineScale || 1));
  const subHeadlineFontSize = isSquare ? 52 : 44;

  // Auto-scale headline to fit container width — prevents text overflow
  const longestLineChars = Math.max(...headlineLines.map(l => l.length), 1);
  // Available width: glass card = maxWidth minus padding, direct = canvas minus padding
  const glassCardContentWidth = isSquare ? (dims.width * 0.84 - 112) : (dims.width * 0.80 - 96);
  const directContentWidth = dims.width - (isSquare ? 120 : 100);
  const availableWidth = design.showGlassCard ? glassCardContentWidth : directContentWidth;
  // Approximate character width factor: Host Grotesk ExtraBold Expanded ≈ 0.82em per char
  const maxFontForFit = availableWidth / (longestLineChars * 0.82);
  const headlineFontSize = Math.min(rawHeadlineFontSize, Math.round(maxFontForFit));

  const useGradientHeadline = design.headlineGradient !== false;

  const alignMap = { left: "flex-start", center: "center", right: "flex-end" };
  const textAlignMap = { left: "left" as const, center: "center" as const, right: "right" as const };
  const justifyMap = { top: "flex-start", center: "center", bottom: "flex-end" };

  // Glass card position mapping
  const glassCardPositions: Record<string, React.CSSProperties> = {
    center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
    "top-center": { top: isSquare ? "8%" : "10%", left: "50%", transform: "translateX(-50%)" },
    "bottom-center": { bottom: isSquare ? "8%" : "10%", left: "50%", transform: "translateX(-50%)" },
    "center-left": { top: "50%", left: isSquare ? "8%" : "6%", transform: "translateY(-50%)" },
    "center-right": { top: "50%", right: isSquare ? "8%" : "6%", transform: "translateY(-50%)" },
  };

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        position: "relative",
        overflow: "hidden",
        fontFamily: FONTS.body,
        background: COLORS.background,
      }}
    >
      {/* Background — liquid metal shader */}
      <LiquidMetalBg mood={design.backgroundId} width={dims.width} height={dims.height} paused={paused} />

      {/* Color overlay */}
      {design.overlayColor && (design.overlayOpacity ?? 0) > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: design.overlayColor,
            opacity: design.overlayOpacity,
            mixBlendMode: (design.overlayBlend || "multiply") as React.CSSProperties["mixBlendMode"],
          }}
        />
      )}

      {/* Dark overlay — adapts to text position, only when there's content */}
      {hasHeadline && !design.showGlassCard && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              design.textPosition === "bottom"
                ? "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.8) 100%)"
                : design.textPosition === "top"
                  ? "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 100%)"
                  : "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.5) 100%)",
          }}
        />
      )}

      {/* === DECORATIVE ELEMENTS === */}

      {/* Top bar — thin gradient strip */}
      {design.showTopBar && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: GRADIENT_BORDER_CSS,
            zIndex: 2,
          }}
        />
      )}

      {/* === GLASS CARD — frosted dark container for text === */}
      {design.showGlassCard && hasHeadline && (() => {
        const pos = design.glassCardPosition || "center";
        return (
          <div
            style={{
              position: "absolute",
              zIndex: 2,
              ...glassCardPositions[pos],
              maxWidth: isSquare ? "84%" : "80%",
              padding: isSquare ? "48px 56px" : "40px 48px",
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderRadius: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: alignMap[design.alignment || "center"],
              textAlign: textAlignMap[design.alignment || "center"],
            }}
          >
            {/* 1px gradient border on glass card */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 24,
                border: "1px solid transparent",
                background: `linear-gradient(135deg, rgba(255,208,0,0.4), rgba(255,107,0,0.3), rgba(255,0,40,0.4)) border-box`,
                WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                maskComposite: "exclude" as never,
                pointerEvents: "none",
              }}
            />

            {/* Headline */}
            {headlineLines.map((line, i) => {
              const isFirstLine = i === 0;
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: isFirstLine ? FONTS.headline : FONTS.subtitle,
                    fontWeight: isFirstLine ? 800 : 700,
                    fontStretch: isFirstLine ? "expanded" : "normal",
                    fontSize: isFirstLine ? headlineFontSize : subHeadlineFontSize,
                    lineHeight: 1.05,
                    letterSpacing: isFirstLine ? "-1px" : "2px",
                    textTransform: "uppercase" as const,
                    marginTop: i > 0 ? 8 : 0,
                    ...(isFirstLine && useGradientHeadline
                      ? {
                          background: GRADIENT_TEXT_CSS,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }
                      : { color: COLORS.text }),
                  }}
                >
                  {line}
                </div>
              );
            })}

            {/* Subtitle inside card */}
            {design.subtitle && (
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: isSquare ? 22 : 20,
                  color: COLORS.textMuted,
                  marginTop: 20,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase" as const,
                }}
              >
                {design.subtitle}
              </div>
            )}

            {/* Partner name pill inside card */}
            {design.partnerName && (
              <div
                style={{
                  display: "inline-block",
                  position: "relative",
                  marginTop: 20,
                  padding: "8px 24px",
                  background: "rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  fontFamily: FONTS.subtitle,
                  fontWeight: 600,
                  fontSize: isSquare ? 20 : 18,
                  color: COLORS.text,
                  letterSpacing: "1px",
                  alignSelf:
                    design.alignment === "left" ? "flex-start"
                    : design.alignment === "right" ? "flex-end"
                    : "center",
                }}
              >
                {design.partnerName}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 8,
                    border: "1px solid transparent",
                    background: `linear-gradient(135deg, #FFD000, #FF6B00, #FF0028) border-box`,
                    WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                    maskComposite: "exclude" as never,
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}

            {/* Partner logo inside card */}
            {partnerLogo && (
              <div
                style={{
                  marginTop: 20,
                  position: "relative",
                  width: isSquare ? 180 : 160,
                  height: isSquare ? 100 : 80,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: 14,
                  alignSelf:
                    design.alignment === "left" ? "flex-start"
                    : design.alignment === "right" ? "flex-end"
                    : "center",
                }}
              >
                <img
                  src={partnerLogo}
                  alt="Partner"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 12,
                    border: "1px solid transparent",
                    background: `linear-gradient(135deg, #FFD000, #FF6B00, #FF0028) border-box`,
                    WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                    maskComposite: "exclude" as never,
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* === CANVAS IMAGES === */}
      {canvasImages?.map((ci) => {
        const imgW = Math.round(dims.width * ci.width);
        const imgH = Math.round(dims.height * ci.height);
        const imgLeft = Math.round(ci.x * dims.width - imgW / 2);
        const imgTop = Math.round(ci.y * dims.height - imgH / 2);
        const isCircle = ci.shape === "circle";
        const radius = isCircle ? "50%" : 16;
        return (
          <div
            key={ci.id}
            style={{
              position: "absolute",
              zIndex: 2,
              left: imgLeft,
              top: imgTop,
              width: imgW,
              height: imgH,
              borderRadius: radius,
              overflow: "hidden",
            }}
          >
            <img
              src={ci.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {ci.border && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: radius,
                  border: "1px solid transparent",
                  background: "linear-gradient(135deg, #FFD000, #FF6B00, #FF0028) border-box",
                  WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude" as never,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        );
      })}

      {/* === CONTENT (no glass card mode) === */}
      {!design.showGlassCard && (
        <div
          style={{
            position: "relative",
            zIndex: 3,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: justifyMap[design.textPosition || "center"],
            alignItems: alignMap[design.alignment || "center"],
            padding: isSquare
              ? design.alignment === "center" ? "80px 60px" : "80px 50px"
              : design.alignment === "center" ? "50px 60px" : "50px 50px",
            textAlign: textAlignMap[design.alignment || "center"],
          }}
        >
          {/* Headline lines */}
          {headlineLines.map((line, i) => {
            const isFirstLine = i === 0;
            return (
              <div
                key={i}
                style={{
                  fontFamily: isFirstLine ? FONTS.headline : FONTS.subtitle,
                  fontWeight: isFirstLine ? 800 : 700,
                  fontStretch: isFirstLine ? "expanded" : "normal",
                  fontSize: isFirstLine ? headlineFontSize : subHeadlineFontSize,
                  lineHeight: 1.05,
                  letterSpacing: isFirstLine ? "-1px" : "2px",
                  textTransform: "uppercase" as const,
                  marginTop: i > 0 ? 8 : 0,
                  ...(isFirstLine
                    ? {
                        background: GRADIENT_TEXT_CSS,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }
                    : { color: COLORS.text }),
                }}
              >
                {line}
              </div>
            );
          })}

          {/* Partner name pill */}
          {design.partnerName && (
            <div
              style={{
                display: "inline-block",
                position: "relative",
                marginTop: 24,
                padding: "10px 28px",
                background: "rgba(0, 0, 0, 0.7)",
                borderRadius: 10,
                fontFamily: FONTS.subtitle,
                fontWeight: 600,
                fontSize: isSquare ? 22 : 20,
                color: COLORS.text,
                letterSpacing: "1px",
                alignSelf:
                  design.alignment === "left" ? "flex-start"
                  : design.alignment === "right" ? "flex-end"
                  : "center",
              }}
            >
              {design.partnerName}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  border: "1px solid transparent",
                  background: `linear-gradient(135deg, #FFD000, #FF6B00, #FF0028) border-box`,
                  WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude" as never,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

          {/* Partner logo */}
          {partnerLogo && (
            <div
              style={{
                marginTop: 20,
                position: "relative",
                width: isSquare ? 200 : 180,
                height: isSquare ? 120 : 100,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.6)",
                padding: 16,
                alignSelf:
                  design.alignment === "left" ? "flex-start"
                  : design.alignment === "right" ? "flex-end"
                  : "center",
              }}
            >
              <img
                src={partnerLogo}
                alt="Partner"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 14,
                  border: "1px solid transparent",
                  background: `linear-gradient(135deg, #FFD000, #FF6B00, #FF0028) border-box`,
                  WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude" as never,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

          {/* Additional text */}
          {design.additionalText && (
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: isSquare ? 22 : 20,
                color: COLORS.text,
                marginTop: 16,
                letterSpacing: "0.5px",
              }}
            >
              {design.additionalText}
            </div>
          )}

          {/* Subtitle */}
          {design.subtitle && (
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: isSquare ? 22 : 20,
                color: COLORS.textMuted,
                marginTop: design.additionalText ? 8 : 24,
                letterSpacing: "1.5px",
                textTransform: "uppercase" as const,
              }}
            >
              {design.subtitle}
            </div>
          )}
        </div>
      )}

      {/* TECHBBQ logo — configurable position */}
      {design.showLogo && (() => {
        const pos = design.logoPosition || "bottom-center";
        const pad = isSquare ? 72 : 50;
        const logoPos: React.CSSProperties = {
          position: "absolute",
          zIndex: 4,
          ...(pos.startsWith("top") ? { top: pad } : { bottom: pad }),
          ...(pos.endsWith("left")
            ? { left: pad }
            : pos.endsWith("right")
              ? { right: pad }
              : { left: "50%", transform: "translateX(-50%)" }),
        };
        const logoH = isSquare ? 28 : 24;
        const logoSrc =
          design.logoStyle === "gradient" ? "/TechBBQ Logo Gradient.png"
          : design.logoStyle === "white" ? "/TechBBQ Logo White.png"
          : "/TechBBQ Logo Red.png";

        return (
          <div style={logoPos}>
            <img
              src={logoSrc}
              alt="TechBBQ"
              style={{
                height: logoH,
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
