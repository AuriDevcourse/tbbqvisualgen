"use client";

import { useState } from "react";
import { ChevronDown, Folder, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { projectLogoCount, type PartnerProject, type PartnerSet } from "@/data/partnerSets";

/**
 * The ready-made thank-you walls, filed by project.
 *
 * The Thank you sidebar used to list every set as one flat fill button, which
 * hid the two things anyone actually wants to know: which projects we hold logos
 * for, and which logos a project holds. Filling a wall was the only way to see a
 * roster, and undoing it cost the design you were working on.
 *
 * So: one folder per project, and every set opens to its logos rendered from the
 * same library files the fill uses. Reading the roster is now free.
 */
interface PartnerSetBrowserProps {
  projects: PartnerProject[];
  /** Set id currently loading, or null. Disables every fill button while set. */
  fillingSet: string | null;
  onFill: (set: PartnerSet) => void;
}

export function PartnerSetBrowser({ projects, fillingSet, onFill }: PartnerSetBrowserProps) {
  // The first project open, the rest closed: the sidebar is a narrow column and
  // three open folders push the background picker off the screen.
  const [openProject, setOpenProject] = useState<string | null>(projects[0]?.id ?? null);
  // Which set's roster is expanded. One at a time, for the same reason.
  const [openSet, setOpenSet] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      {projects.map((project) => {
        const open = openProject === project.id;
        return (
          <div key={project.id} className="rounded-xl border border-white/10 bg-white/[0.03]">
            <button
              onClick={() => setOpenProject(open ? null : project.id)}
              aria-expanded={open}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              {open
                ? <FolderOpen className="w-4 h-4 shrink-0 text-[#FF6B00]" strokeWidth={1.5} />
                : <Folder className="w-4 h-4 shrink-0 text-white/50" strokeWidth={1.5} />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-white/85 truncate">{project.name}</span>
                <span className="block text-[10px] leading-tight text-white/45 truncate">{project.note}</span>
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                {projectLogoCount(project)} logos
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
              />
            </button>

            {open && (
              <div className="flex flex-col gap-1.5 border-t border-white/10 px-2 py-2">
                {project.sets.map((set) => {
                  const loading = fillingSet === set.id;
                  const rosterOpen = openSet === set.id;
                  return (
                    <div key={set.id}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onFill(set)}
                          disabled={fillingSet !== null}
                          title={`Fills the wall with the ${set.name} logos and the headline "${set.headline}"`}
                          className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/85 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading
                            ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />}
                          <span className="min-w-0 flex-1 truncate text-left">
                            {loading ? "Loading logos…" : `Fill with ${set.name}`}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-white/45">{set.logos.length}</span>
                        </button>
                        <button
                          onClick={() => setOpenSet(rosterOpen ? null : set.id)}
                          aria-expanded={rosterOpen}
                          aria-label={rosterOpen ? `Hide the ${set.name} logos` : `Show the ${set.name} logos`}
                          title={rosterOpen ? "Hide these logos" : "See these logos"}
                          className="w-8 h-[34px] shrink-0 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/85 transition-colors"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${rosterOpen ? "rotate-0" : "-rotate-90"}`}
                          />
                        </button>
                      </div>

                      {/* The roster. Capped and scrollable: Participating is 43
                          rows and would bury everything below it. */}
                      {rosterOpen && (
                        <ul className="mt-1.5 grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {set.logos.map((logo) => (
                            <li
                              key={logo.src}
                              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- library file, same plain img the logo picker uses */}
                              <img
                                src={logo.src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="w-8 h-5 shrink-0 object-contain"
                              />
                              <span className="min-w-0 text-[10px] leading-tight text-white/70 truncate" title={logo.label}>
                                {logo.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
