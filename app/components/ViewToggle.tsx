'use client';

import React, { useState } from 'react';
import { LayoutList, LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'table' | 'cards' | 'dense';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onChange }) => {
  const [hoverView, setHoverView] = useState<ViewMode | null>(null);

  const views: Array<{ mode: ViewMode; icon: React.ReactNode; label: string; tooltip: string }> = [
    {
      mode: 'table',
      icon: <LayoutList className="w-5 h-5" />,
      label: 'Table',
      tooltip: 'Table view'
    },
    {
      mode: 'cards',
      icon: <LayoutGrid className="w-5 h-5" />,
      label: 'Cards',
      tooltip: 'Card view'
    },
    {
      mode: 'dense',
      icon: <List className="w-5 h-5" />,
      label: 'Dense',
      tooltip: 'Dense view'
    }
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {views.map(({ mode, icon, label, tooltip }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          onMouseEnter={() => setHoverView(mode)}
          onMouseLeave={() => setHoverView(null)}
          aria-label={tooltip}
          title={tooltip}
          className={`p-2 rounded-md transition-all duration-200 relative group ${
            viewMode === mode
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          {icon}
          
          {/* Tooltip */}
          <div
            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none transition-opacity duration-200 ${
              hoverView === mode ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {tooltip}
          </div>
        </button>
      ))}
    </div>
  );
};

export default ViewToggle;
