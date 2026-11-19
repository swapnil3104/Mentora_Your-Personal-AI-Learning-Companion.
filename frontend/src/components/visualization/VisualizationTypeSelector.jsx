import React from 'react';
import {
  LayoutGrid,
  Network,
  GitFork,
  Sparkles,
  Workflow,
  Layers,
} from 'lucide-react';

export const VISUALIZATION_TYPES = [
  {
    id: 'infographic',
    name: 'Infographic',
    renderer: 'svg_html',
    icon: LayoutGrid,
    desc: 'Structured visual summaries with sections, metrics, and key takeaways.',
    badge: 'SVG / HTML',
  },
  {
    id: 'concept_map',
    name: 'Concept Map',
    renderer: 'react_flow',
    icon: Network,
    desc: 'Interconnected nodes with labeled propositions and conceptual links.',
    badge: 'React Flow',
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    renderer: 'mermaid',
    icon: GitFork,
    desc: 'Step-by-step decision algorithms and conditional execution branches.',
    badge: 'Mermaid.js',
  },
  {
    id: 'mind_map',
    name: 'Mind Map',
    renderer: 'react_flow',
    icon: Sparkles,
    desc: 'Hierarchical expansion spreading from central topic to subtopics.',
    badge: 'React Flow',
  },
  {
    id: 'process_diagram',
    name: 'Process Diagram',
    renderer: 'mermaid',
    icon: Workflow,
    desc: 'Sequential phases, input dependencies, and output artifacts.',
    badge: 'Mermaid.js',
  },
  {
    id: 'architecture_diagram',
    name: 'Architecture Diagram',
    renderer: 'mermaid',
    icon: Layers,
    desc: 'System components, multi-tier boundaries, and communication flows.',
    badge: 'Mermaid.js',
  },
];

export const VisualizationTypeSelector = ({ selectedType, onSelect, disabled }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {VISUALIZATION_TYPES.map((type) => {
        const Icon = type.icon;
        const isSelected = selectedType === type.id;

        return (
          <button
            key={type.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(type.id)}
            className={`p-3.5 rounded-xl border text-left transition-all flex gap-3 items-start relative ${
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20 dark:bg-primary/10'
                : 'border-border-light dark:border-border-dark bg-white dark:bg-surface-dark hover:border-primary/40 hover:shadow-xs'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 transition-colors ${
                isSelected
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-primary/10 text-primary dark:text-primary-dark'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <h3 className="text-xs font-bold text-text-primary dark:text-text-darkPrimary truncate">
                  {type.name}
                </h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background-light dark:bg-surface-elevated text-text-secondary dark:text-text-darkSecondary border border-border-light/50 dark:border-border-dark/50">
                  {type.badge}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary dark:text-text-darkSecondary line-clamp-2 leading-relaxed">
                {type.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default VisualizationTypeSelector;
