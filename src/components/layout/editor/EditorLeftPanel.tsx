import React from 'react';
import { DimensionSelector } from '@/components/sidebar/Geometry/DimensionSelector';
import { ObjectSettingsSection } from '@/components/sidebar/Geometry/ObjectSettingsSection';
import { ObjectTypeExplorer } from './ObjectTypeExplorer';

export const EditorLeftPanel: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-panel-bg shrink-0 overflow-hidden">
        {/* Fixed Header Section with Dimension Selector */}
        <div className="p-4 border-b border-panel-border bg-panel-bg/95 backdrop-blur-sm z-10">
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4">Space & Object</h2>
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <label className="text-[10px] text-text-secondary/70 font-bold uppercase tracking-wider">Dimensions</label>
                </div>
                <DimensionSelector />
            </div>
        </div>
        
        {/* Scrollable Content Section with Shape Explorer */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-panel-border hover:scrollbar-thumb-text-secondary/50">
             <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[10px] text-text-secondary/70 font-bold uppercase tracking-wider sticky top-0 bg-panel-bg py-1 z-10 block">Available Shapes</label>
                    <ObjectTypeExplorer />
                </div>

                <div className="space-y-3 pt-4 border-t border-panel-border">
                    <label className="text-[10px] text-text-secondary/70 font-bold uppercase tracking-wider block">Parameters</label>
                    <ObjectSettingsSection />
                </div>
            </div>
        </div>
    </div>
  );
};