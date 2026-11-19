import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export const SourceReferences = ({ sources = [] }) => {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="border border-border-light dark:border-border-dark rounded-xl bg-white/70 dark:bg-surface-dark/70 overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-text-primary dark:text-text-darkPrimary">
            Grounded Academic Sources ({sources.length})
          </span>
          <span className="text-[11px] text-text-secondary dark:text-text-darkSecondary">
            — Verifiable document chunks supporting this visualization
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-text-secondary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-secondary" />
        )}
      </button>

      {expanded && (
        <div className="p-3 border-t border-border-light dark:border-border-dark space-y-2 bg-background-light/30 dark:bg-surface-elevated/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sources.map((src, idx) => (
              <div
                key={src.chunk_id || idx}
                className="p-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-xs flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-text-primary dark:text-text-darkPrimary truncate max-w-[75%]">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{src.document_name || 'Academic Document'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary dark:text-primary-dark">
                    Page {src.page_number}
                  </span>
                </div>

                {src.snippet && (
                  <p className="text-[11px] text-text-secondary dark:text-text-darkSecondary italic line-clamp-3 bg-background-light/50 dark:bg-surface-elevated/50 p-2 rounded border border-border-light/40 dark:border-border-dark/40">
                    "{src.snippet.trim()}"
                  </p>
                )}

                {src.relevance_score !== undefined && (
                  <div className="text-[10px] text-text-secondary/70 flex justify-between">
                    <span>Relevance: {(src.relevance_score * 100).toFixed(1)}%</span>
                    <span>Chunk ID: {src.chunk_id ? src.chunk_id.slice(0, 8) : `#${idx + 1}`}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceReferences;
