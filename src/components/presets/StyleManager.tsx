import React, { useRef } from 'react';
import { usePresetManagerStore, type SavedStyle, type PresetManagerState } from '@/stores/presetManagerStore';
import { useToast } from '@/contexts/ToastContext';
import { useShallow } from 'zustand/react/shallow';

interface StyleManagerProps {
  onClose: () => void;
}

export const StyleManager: React.FC<StyleManagerProps> = ({ onClose }) => {
  const presetSelector = useShallow((state: PresetManagerState) => ({
    savedStyles: state.savedStyles,
    loadStyle: state.loadStyle,
    deleteStyle: state.deleteStyle,
    importStyles: state.importStyles,
    exportStyles: state.exportStyles
  }));
  const { savedStyles, loadStyle, deleteStyle, importStyles, exportStyles } = usePresetManagerStore(presetSelector);
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importStyles(content)) {
        addToast('Styles imported successfully', 'success');
      } else {
        addToast('Failed to import styles', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const handleExport = () => {
    const data = exportStyles();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdimension-styles-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Styles exported', 'success');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 bg-panel-header hover:bg-white/10 text-xs py-2 rounded border border-panel-border transition-colors text-text-secondary hover:text-text-primary"
        >
          Import JSON
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".json" 
          onChange={handleImport} 
        />
        <button 
          onClick={handleExport}
          className="flex-1 bg-panel-header hover:bg-white/10 text-xs py-2 rounded border border-panel-border transition-colors text-text-secondary hover:text-text-primary"
        >
          Export JSON
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Saved Styles</h3>
        
        {savedStyles.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm italic border border-dashed border-panel-border rounded">
            No saved styles yet.
          </div>
        ) : (
          <div className="space-y-2">
            {savedStyles.map((style: SavedStyle) => (
              <div 
                key={style.id} 
                className="group flex items-center justify-between p-3 bg-white/5 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-panel-border"
              >
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    loadStyle(style.id);
                    addToast(`Applied style: ${style.name}`, 'info');
                    onClose();
                  }}
                >
                  <div className="font-medium text-sm text-text-primary">{style.name}</div>
                  <div className="text-[10px] text-text-secondary">{formatDate(style.timestamp)}</div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete style "${style.name}"?`)) {
                      deleteStyle(style.id);
                      addToast('Style deleted', 'info');
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
