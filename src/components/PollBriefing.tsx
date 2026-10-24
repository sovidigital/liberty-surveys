'use client';

import { PollSource } from '@/types';

interface PollBriefingProps {
  background: string | null;
  conservative: string | null;
  liberal: string | null;
  centrist: string | null;
  sources?: PollSource[];
  compact?: boolean;
}

export function PollBriefing({
  background,
  conservative,
  liberal,
  centrist,
  sources = [],
  compact = false,
}: PollBriefingProps) {
  const hasContent = background || conservative || liberal || centrist;
  
  if (!hasContent) {
    return null;
  }
  
  const cleanText = (text: string | null): string => {
    if (!text) return '';
    return text.replace(/\[SAMPLE DATA\]\s*/g, '');
  };
  
  const getSourcesForPerspective = (perspective: string): PollSource[] => {
    return sources.filter(s => s.perspective_used === perspective);
  };
  
  const SourcesList = ({ perspectiveSources }: { perspectiveSources: PollSource[] }) => {
    if (perspectiveSources.length === 0) return null;
    
    return (
      <div className="mt-2 text-xs text-gray-500">
        {perspectiveSources.map((source, i) => (
          <span key={source.id}>
            {i > 0 && ', '}
            <a 
              href={source.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-gray-700"
            >
              {source.source_name}
            </a>
          </span>
        ))}
      </div>
    );
  };
  
  if (compact) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Background</h4>
        <p className="text-gray-700 text-sm">{cleanText(background)}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
          <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
          Background
        </h3>
        <p className="text-gray-700 leading-relaxed">{cleanText(background)}</p>
        <SourcesList perspectiveSources={getSourcesForPerspective('background')} />
      </div>
      
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-red-50 rounded-lg p-5 border border-red-100">
          <h3 className="font-semibold text-red-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            Conservative View
          </h3>
          <p className="text-red-900/80 text-sm leading-relaxed">{cleanText(conservative)}</p>
          <SourcesList perspectiveSources={getSourcesForPerspective('conservative')} />
        </div>
        
        <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            Liberal View
          </h3>
          <p className="text-blue-900/80 text-sm leading-relaxed">{cleanText(liberal)}</p>
          <SourcesList perspectiveSources={getSourcesForPerspective('liberal')} />
        </div>
        
        <div className="bg-purple-50 rounded-lg p-5 border border-purple-100">
          <h3 className="font-semibold text-purple-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
            Centrist View
          </h3>
          <p className="text-purple-900/80 text-sm leading-relaxed">{cleanText(centrist)}</p>
          <SourcesList perspectiveSources={getSourcesForPerspective('centrist')} />
        </div>
      </div>
      
      {sources.length > 0 && (
        <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
          <span className="font-medium">Sources: </span>
          {sources.map((source, i) => (
            <span key={source.id}>
              {i > 0 && ' · '}
              <a 
                href={source.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-gray-700"
              >
                {source.source_name}
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
