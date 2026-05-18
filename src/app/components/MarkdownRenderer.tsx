import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
        h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2 mt-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1 mt-2">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc list-inside text-sm space-y-1 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-sm space-y-1 mb-2">{children}</ol>,
        li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-purple-300">
              {children}
            </code>
          ) : (
            <pre className="bg-white/5 border border-white/10 rounded-lg p-3 my-2 overflow-auto">
              <code className="text-xs font-mono text-gray-300">{children}</code>
            </pre>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-500/50 pl-3 my-2 text-gray-400 italic">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} className="text-purple-400 hover:text-purple-300 underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        hr: () => <hr className="border-white/10 my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
