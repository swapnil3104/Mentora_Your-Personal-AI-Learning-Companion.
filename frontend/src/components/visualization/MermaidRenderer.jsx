import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const MermaidRenderer = ({
  chart,
  zoom = 1,
  onRenderSuccess,
  containerRef,
}) => {
  const renderDivRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
      },
      fontFamily: 'Inter, system-ui, sans-serif',
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!chart || !chart.trim()) {
      setSvgContent('');
      return;
    }

    const renderChart = async () => {
      setRendering(true);
      setError(null);
      const uniqueId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;

      try {
        const cleanChart = chart.replace(/\\n/g, '\n').trim();
        const { svg } = await mermaid.render(uniqueId, cleanChart);
        if (isMounted) {
          setSvgContent(svg);
          setRendering(false);
          if (onRenderSuccess) onRenderSuccess(svg);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Mermaid render error:', err);
          setError(err.message || 'Syntax error in generated diagram.');
          setRendering(false);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      // Cleanup any dangling temporary elements mermaid may inject
      const existing = document.getElementById(renderDivRef.current?.id);
      if (existing && existing.tagName === 'svg') {
        existing.remove();
      }
    };
  }, [chart]);

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm">
          <AlertTriangle className="h-5 w-5" />
          <span>Diagram Render Error</span>
        </div>
        <p className="text-xs text-text-secondary dark:text-text-darkSecondary max-w-md mx-auto">
          {error}
        </p>
        <div className="text-left max-w-lg mx-auto p-3 rounded bg-black/5 dark:bg-white/5 font-mono text-[11px] overflow-x-auto">
          <pre>{chart}</pre>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[450px] flex items-center justify-center p-4 overflow-auto select-none mermaid-export-target"
    >
      {rendering ? (
        <div className="flex items-center gap-2 text-xs text-text-secondary animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>Rendering diagram syntax...</span>
        </div>
      ) : (
        <div
          ref={renderDivRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="transition-transform duration-150 flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  );
};

export default MermaidRenderer;
