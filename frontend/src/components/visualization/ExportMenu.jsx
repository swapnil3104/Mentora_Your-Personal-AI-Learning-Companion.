import React, { useState } from 'react';
import { Download, Image as ImageIcon, FileCode, Check } from 'lucide-react';

export const ExportMenu = ({ targetRef, title = 'diagram', vtype }) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanFilename = (title || 'diagram')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const exportSVG = () => {
    if (!targetRef?.current) return;
    setDownloading(true);

    try {
      let svgElement = targetRef.current.querySelector('svg');
      let svgData = '';

      if (svgElement) {
        const serializer = new XMLSerializer();
        svgData = serializer.serializeToString(svgElement);
      } else {
        // Fallback for HTML content wrapped in foreignObject SVG
        const content = targetRef.current.outerHTML;
        svgData = `
          <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml">
                ${content}
              </div>
            </foreignObject>
          </svg>
        `;
      }

      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cleanFilename}-${vtype}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export SVG:', err);
    } finally {
      setDownloading(false);
    }
  };

  const exportPNG = () => {
    if (!targetRef?.current) return;
    setDownloading(true);

    try {
      const svgElement = targetRef.current.querySelector('svg');
      if (svgElement) {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const bbox = svgElement.getBoundingClientRect();
          const width = Math.max(800, bbox.width * 2);
          const height = Math.max(600, bbox.height * 2);

          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);

          const png = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `${cleanFilename}-${vtype}.png`;
          link.href = png;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobURL);
          setDownloading(false);
        };
        image.src = blobURL;
      } else {
        // Direct print/screenshot fallback
        window.print();
        setDownloading(false);
      }
    } catch (err) {
      console.error('Failed to export PNG:', err);
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={exportSVG}
        disabled={downloading}
        className="px-2.5 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark hover:bg-background-light dark:hover:bg-surface-elevated text-text-primary dark:text-text-darkPrimary text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
        title="Export Vector SVG"
      >
        <FileCode className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">Export SVG</span>
      </button>

      <button
        type="button"
        onClick={exportPNG}
        disabled={downloading}
        className="px-2.5 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark hover:bg-background-light dark:hover:bg-surface-elevated text-text-primary dark:text-text-darkPrimary text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
        title="Export High-Res PNG"
      >
        <ImageIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">Export PNG</span>
      </button>
    </div>
  );
};

export default ExportMenu;
