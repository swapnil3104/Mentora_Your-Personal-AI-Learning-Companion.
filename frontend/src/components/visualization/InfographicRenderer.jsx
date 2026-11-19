import React from 'react';
import { Sparkles, CheckCircle2, Award, Zap, Bookmark } from 'lucide-react';

export const InfographicRenderer = ({ data, containerRef }) => {
  if (!data) return null;

  const {
    title = 'Academic Study Infographic',
    subtitle = '',
    summary = '',
    sections = [],
    takeaways = [],
  } = data;

  const cardAccents = [
    { border: 'border-blue-500/30', bg: 'bg-blue-500/5', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Zap },
    { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
    { border: 'border-amber-500/30', bg: 'bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Sparkles },
    { border: 'border-purple-500/30', bg: 'bg-purple-500/5', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', icon: Award },
    { border: 'border-rose-500/30', bg: 'bg-rose-500/5', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', icon: Bookmark },
  ];

  return (
    <div
      ref={containerRef}
      className="w-full bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 infographic-export-target"
    >
      {/* Header Banner */}
      <div className="border-b border-border-light dark:border-border-dark pb-6 text-center space-y-2 relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:text-primary-dark">
          <Sparkles className="h-3.5 w-3.5" />
          <span>STRUCTURED STUDY SUMMARY</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary dark:text-text-darkPrimary">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm font-medium text-text-secondary dark:text-text-darkSecondary max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}

        {summary && (
          <div className="mt-4 p-4 rounded-xl bg-background-light dark:bg-surface-elevated text-xs sm:text-sm text-text-primary dark:text-text-darkPrimary border border-border-light/60 dark:border-border-dark/60 max-w-3xl mx-auto text-left shadow-xs">
            <span className="font-bold text-primary dark:text-primary-dark mr-1">Core Concept:</span>
            {summary}
          </div>
        )}
      </div>

      {/* Structured Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section, idx) => {
          const accent = cardAccents[idx % cardAccents.length];
          const AccentIcon = accent.icon;

          return (
            <div
              key={idx}
              className={`p-5 rounded-xl border ${accent.border} ${accent.bg} flex flex-col justify-between transition-all hover:shadow-sm`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${accent.badge}`}>
                      <AccentIcon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      {section.category || `Section 0${idx + 1}`}
                    </span>
                  </div>
                  {section.stat && (
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-white dark:bg-surface-dark border border-border-light/60 dark:border-border-dark/60 text-primary">
                      {section.stat}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-text-primary dark:text-text-darkPrimary">
                  {section.heading}
                </h3>

                {section.description && (
                  <p className="text-xs text-text-secondary dark:text-text-darkSecondary leading-relaxed">
                    {section.description}
                  </p>
                )}

                {section.key_points && section.key_points.length > 0 && (
                  <ul className="space-y-1.5 pt-2 border-t border-border-light/40 dark:border-border-dark/40">
                    {section.key_points.map((pt, pIdx) => (
                      <li key={pIdx} className="text-xs text-text-primary dark:text-text-darkPrimary flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span className="leading-snug">{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Takeaways Bottom Strip */}
      {takeaways && takeaways.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary dark:text-primary-dark">
            <Award className="h-4 w-4" />
            <span>EXAM & MASTERY TAKEAWAYS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-text-primary dark:text-text-darkPrimary">
            {takeaways.map((takeaway, tIdx) => (
              <div key={tIdx} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>{takeaway}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfographicRenderer;
