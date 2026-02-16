"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Trash2, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DesignConfig } from "@/types/template";

interface SavedTemplate {
  id: string;
  name: string;
  design: DesignConfig;
  createdAt: number;
}

const STORAGE_KEY = "tbbq-templates";

function loadTemplates(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: SavedTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// Built-in starter presets
const PRESETS: SavedTemplate[] = [
  {
    id: "preset-speaker",
    name: "Speaker Announcement",
    createdAt: 0,
    design: {
      headline: "",
      subtitle: "",
      backgroundId: "lm1",
      alignment: "center",
      textPosition: "center",
      headlineScale: 1.1,
      showGlassCard: true,
      glassCardPosition: "center",
      showLogo: true,
      logoPosition: "bottom-center",
      logoStyle: "red",
    },
  },
  {
    id: "preset-stat",
    name: "Big Stat / Number",
    createdAt: 0,
    design: {
      headline: "",
      subtitle: "",
      backgroundId: "lm4",
      alignment: "center",
      textPosition: "center",
      headlineScale: 1.4,
      showGlassCard: false,
      showLogo: true,
      logoPosition: "bottom-center",
      logoStyle: "white",
    },
  },
  {
    id: "preset-partner",
    name: "Partner Highlight",
    createdAt: 0,
    design: {
      headline: "",
      subtitle: "",
      backgroundId: "lm2",
      alignment: "center",
      textPosition: "center",
      headlineScale: 1.1,
      showGlassCard: true,
      glassCardPosition: "center",
      showLogo: true,
      logoPosition: "bottom-right",
      logoStyle: "gradient",
    },
  },
  {
    id: "preset-event",
    name: "Event / CTA",
    createdAt: 0,
    design: {
      headline: "",
      subtitle: "",
      backgroundId: "lm5",
      alignment: "center",
      textPosition: "center",
      headlineScale: 1.2,
      showGlassCard: true,
      glassCardPosition: "center",
      showLogo: true,
      logoPosition: "bottom-center",
      logoStyle: "red",
    },
  },
];

interface TemplatesPanelProps {
  currentDesign: DesignConfig;
  onApply: (design: DesignConfig) => void;
}

export function TemplatesPanel({ currentDesign, onApply }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const newTemplate: SavedTemplate = {
      id: `tpl-${Date.now()}`,
      name: saveName.trim(),
      design: { ...currentDesign },
      createdAt: Date.now(),
    };
    const updated = [newTemplate, ...templates];
    setTemplates(updated);
    saveTemplates(updated);
    setSaveName("");
    setShowSave(false);
    toast.success(`Template "${newTemplate.name}" saved`);
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    toast("Template deleted");
  };

  const handleApply = (t: SavedTemplate) => {
    // Apply template design but keep content (headline/subtitle) empty so AI fills them
    onApply({ ...t.design, headline: currentDesign.headline, subtitle: currentDesign.subtitle });
    toast.success(`Applied "${t.name}"`);
  };

  const allTemplates = [...PRESETS, ...templates];

  return (
    <div className="flex flex-col gap-2">
      {/* Save current */}
      <AnimatePresence>
        {showSave ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 mb-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Template name..."
                autoFocus
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[#f2f2f2] placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="px-3 py-1.5 bg-[#FF0028] hover:bg-[#E00224] rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-30"
              >
                Save
              </button>
              <button
                onClick={() => setShowSave(false)}
                className="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowSave(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-white/20 hover:border-white/40 text-xs text-white/50 hover:text-white/70 transition-colors"
          >
            <Save className="w-3 h-3" />
            Save current as template
          </motion.button>
        )}
      </AnimatePresence>

      {/* Template list */}
      <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
        {allTemplates.map((t) => {
          const isPreset = t.id.startsWith("preset-");
          return (
            <motion.button
              key={t.id}
              layout
              onClick={() => handleApply(t)}
              className={cn(
                "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                "bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15"
              )}
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <span className="text-xs text-white/70 group-hover:text-white/90 flex-1 truncate">
                {t.name}
              </span>
              {isPreset && (
                <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0">Built-in</span>
              )}
              {!isPreset && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                >
                  <Trash2 className="w-3 h-3 text-white/40 hover:text-[#FF0028]" />
                </button>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
