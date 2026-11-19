import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

const CodeBlock = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && (match || codeString.includes('\n'))) {
    return (
      <div className="relative my-3 rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-[#0f172a] text-slate-100 text-xs font-mono">
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1e293b]/70 border-b border-border-dark/30 text-[11px] text-slate-400">
          <span className="uppercase font-semibold tracking-wider">{match ? match[1] : 'code'}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-white transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 overflow-x-auto text-[12px] leading-relaxed">
          <code>{children}</code>
        </pre>
      </div>
    );
  }

  return (
    <code
      className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[0.88em] text-primary dark:text-primary-light"
      {...props}
    >
      {children}
    </code>
  );
};

export const MarkdownContent = ({ content }) => {
  if (!content) return null;

  return (
    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mt-2.5 mb-1">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-3 py-1 my-2 text-text-secondary dark:text-text-darkSecondary italic bg-primary/5 rounded-r">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-black/5 dark:bg-white/5 font-semibold text-text-primary dark:text-text-darkPrimary">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border-light dark:divide-border-dark bg-transparent">
              {children}
            </tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-left">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

