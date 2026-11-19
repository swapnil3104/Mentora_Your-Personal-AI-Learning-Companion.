import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Edit3,
  Save,
} from 'lucide-react';
import { ExportMenu } from './ExportMenu';

export const DiagramToolbar = ({
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onFitScreen,
  onRegenerate,
  isRegenerating = false,
  isEditable = false,
  onToggleEdit,
  hasEdits = false,
  onSaveEdits,
  isSaving = false,
  supportsEdit = false,
  targetRef,
  title = '',
  visualizationType = '',
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-background-light/80 dark:bg-surface-elevated/80 border-b border-border-light dark:border-border-dark backdrop-blur-xs">
      {/* Left: Zoom & View Controls */}
      <div className="flex items-center gap-1">
        {onZoomIn && (
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        )}

        {onZoomOut && (
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        )}

        {onFitScreen && (
          <button
            type="button"
            onClick={onFitScreen}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {zoom !== undefined && (
          <span className="text-[11px] font-mono text-text-secondary px-1.5">
            {Math.round(zoom * 100)}%
          </span>
        )}
      </div>

      {/* Center: Editing & Save */}
      <div className="flex items-center gap-1.5">
        {supportsEdit && (
          <button
            type="button"
            onClick={onToggleEdit}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              isEditable
                ? 'bg-primary/10 border-primary text-primary dark:text-primary-dark font-semibold'
                : 'border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-text-secondary hover:text-text-primary'
            }`}
            title="Toggle Node Editing Mode"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>{isEditable ? 'Editing Active' : 'Edit Nodes'}</span>
          </button>
        )}

        {hasEdits && (
          <button
            type="button"
            onClick={onSaveEdits}
            disabled={isSaving}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Save diagram edits to database"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Edits'}</span>
          </button>
        )}
      </div>

      {/* Right: Regenerate & Export */}
      <div className="flex items-center gap-2">
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-2.5 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Regenerate visualization using fresh context"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
        )}

        <ExportMenu
          targetRef={targetRef}
          title={title}
          vtype={visualizationType}
        />
      </div>
    </div>
  );
};

export default DiagramToolbar;
