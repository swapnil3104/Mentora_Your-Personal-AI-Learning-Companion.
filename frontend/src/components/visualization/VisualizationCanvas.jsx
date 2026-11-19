import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { InfographicRenderer } from './InfographicRenderer';
import { MermaidRenderer } from './MermaidRenderer';
import { ReactFlowRenderer } from './ReactFlowRenderer';
import { DiagramToolbar } from './DiagramToolbar';
import { SourceReferences } from './SourceReferences';
import visualizationService from '../../services/visualization.service';
import { Network, Sparkles, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';

export const VisualizationCanvas = ({
  visualization,
  onRegenerate,
  isRegenerating = false,
  onVisualizationUpdated,
}) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [isEditable, setIsEditable] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [currentData, setCurrentData] = useState(visualization?.generatedData || {});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!visualization) {
    return (
      <Card className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-background-light/40 dark:bg-surface-elevated/20 border-dashed">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
          <Network className="h-8 w-8" />
        </div>
        <h4 className="text-base font-semibold text-text-primary dark:text-text-darkPrimary mb-1">
          Canvas Ready for Visual Study Generation
        </h4>
        <p className="text-xs text-text-secondary dark:text-text-darkSecondary max-w-md leading-relaxed mb-6">
          Select an academic document, enter a topic, pick one of the 6 diagram formats above, and click Generate to see your interactive visualization here.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant="outline">Infographics</Badge>
          <Badge variant="outline">Concept Maps</Badge>
          <Badge variant="outline">Flowcharts</Badge>
          <Badge variant="outline">Mind Maps</Badge>
          <Badge variant="outline">Process Diagrams</Badge>
          <Badge variant="outline">Architecture Diagrams</Badge>
        </div>
      </Card>
    );
  }

  const vtype = visualization.visualizationType;
  const title = visualization.title || currentData?.title || 'Academic Visualization';
  const sources = currentData?.sources || [];
  const insufficient = currentData?.insufficientContext || false;

  const isGraphType = ['concept_map', 'mind_map'].includes(vtype);
  const isMermaidType = ['flowchart', 'process_diagram', 'architecture_diagram'].includes(vtype);
  const isInfographic = vtype === 'infographic';

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)));
  const handleFitScreen = () => setZoom(1);

  const handleDataChange = (updatedData) => {
    setCurrentData(updatedData);
    setHasEdits(true);
  };

  const handleSaveEdits = async () => {
    if (!visualization.id) return;
    setIsSaving(true);
    try {
      const updated = await visualizationService.updateVisualization(visualization.id, {
        title,
        generatedData: currentData,
      });
      setHasEdits(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onVisualizationUpdated) onVisualizationUpdated(updated);
    } catch (err) {
      console.error('Failed to save visualization edits:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-xs border-border-light dark:border-border-dark">
      {/* Canvas Header */}
      <CardHeader className="border-b border-border-light dark:border-border-dark pb-3 pt-4 px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {vtype.replace(/_/g, ' ')}
              </Badge>
              {insufficient && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Synthesized Concept Model
                </span>
              )}
              {saveSuccess && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-bold text-text-primary dark:text-text-darkPrimary">
              {title}
            </CardTitle>
            <CardDescription className="text-xs">
              {currentData?.description || currentData?.subtitle || `Grounded visual learning aid for ${visualization.document?.filename || 'selected topic'}`}
            </CardDescription>
          </div>

          {visualization.conversation && (
            <button
              type="button"
              onClick={() => navigate(`/chat?conversation=${visualization.conversation.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary dark:text-primary-dark hover:bg-primary/20 transition-colors border border-primary/20 shrink-0"
              title="Return to original chat conversation"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Return to Chat</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </CardHeader>

      {/* Toolbar Controls */}
      <DiagramToolbar
        zoom={isMermaidType ? zoom : undefined}
        onZoomIn={isMermaidType ? handleZoomIn : undefined}
        onZoomOut={isMermaidType ? handleZoomOut : undefined}
        onFitScreen={isMermaidType ? handleFitScreen : undefined}
        onRegenerate={onRegenerate}
        isRegenerating={isRegenerating}
        supportsEdit={isGraphType}
        isEditable={isEditable}
        onToggleEdit={() => setIsEditable(!isEditable)}
        hasEdits={hasEdits}
        onSaveEdits={handleSaveEdits}
        isSaving={isSaving}
        targetRef={containerRef}
        title={title}
        visualizationType={vtype}
      />

      {/* Rendering Viewport */}
      <CardContent className="flex-1 p-4 bg-background-light/30 dark:bg-surface-elevated/20 overflow-auto min-h-[500px]">
        {isInfographic && (
          <InfographicRenderer
            data={currentData}
            containerRef={containerRef}
          />
        )}

        {isMermaidType && (
          <MermaidRenderer
            chart={currentData.mermaid_syntax || ''}
            zoom={zoom}
            containerRef={containerRef}
          />
        )}

        {isGraphType && (
          <ReactFlowRenderer
            data={currentData}
            visualizationType={vtype}
            isEditable={isEditable}
            onDataChange={handleDataChange}
            containerRef={containerRef}
          />
        )}
      </CardContent>

      {/* Citations Footer */}
      {sources && sources.length > 0 && (
        <div className="p-4 border-t border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
          <SourceReferences sources={sources} />
        </div>
      )}
    </Card>
  );
};

export default VisualizationCanvas;
