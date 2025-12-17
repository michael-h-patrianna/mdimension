import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { DimensionSelector } from '@/components/sections/Geometry/DimensionSelector';
import { ObjectSettingsSection } from '@/components/sections/Geometry/ObjectSettingsSection';
import { ObjectTypeExplorer } from '@/components/sections/ObjectTypes/ObjectTypeExplorer';
import { Tabs, Tab } from '@/components/ui/Tabs';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export const EditorLeftPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('type');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs: Tab[] = [
    {
      id: 'type',
      label: (
        <div className="flex items-center gap-2">
            <Icon name="sphere" size={14} />
            <span>Type</span>
        </div>
      ),
      content: <ObjectTypeExplorer />,
    },
    {
      id: 'geometry',
      label: (
        <div className="flex items-center gap-2">
            <Icon name="cog" size={14} />
            <span>Geometry</span>
        </div>
      ),
      content: <ObjectSettingsSection />,
    },
  ];

  return (
    <m.div 
      initial={false}
      animate={{ width: isCollapsed ? 60 : 320 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full flex flex-col bg-panel-bg/50 border-r border-panel-border shrink-0 overflow-hidden relative backdrop-blur-md"
    >
        {/* Toggle Button - Absolute to stay in place or move with header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center p-4' : 'justify-between p-4'} border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm z-20 shrink-0 h-[60px]`}>
            {!isCollapsed && (
              <div className="flex items-center gap-2 px-1 overflow-hidden whitespace-nowrap">
                  <Icon name="menu" className="text-accent" />
                  <m.h2 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-xs font-bold text-text-secondary uppercase tracking-widest"
                  >
                    Space & Object
                  </m.h2>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={isCollapsed ? "w-full aspect-square" : ""}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name={isCollapsed ? "arrow-right" : "arrow-left"} size={16} />
            </Button>
        </div>

        {/* Content Container */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <m.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden w-[320px]"
            >
               {/* Fixed Header Section with Dimension Selector */}
              <div className="p-4 pt-2 space-y-4 shrink-0">
                  {/* Dimension Selector Area - Spotlight Effect */}
                  <SpotlightCard className="p-3 bg-black/20" spotlightColor="rgba(var(--color-accent), 0.15)">
                       <div className="flex justify-between items-baseline mb-2">
                          <label className="text-[10px] text-accent font-bold uppercase tracking-wider text-glow-subtle flex items-center gap-2">
                              <Icon name="info" size={12} />
                              Dimensions
                          </label>
                      </div>
                      <DimensionSelector />
                  </SpotlightCard>
              </div>
              
              {/* Tabs Section */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <Tabs
                    tabs={tabs}
                    value={activeTab}
                    onChange={setActiveTab}
                    className="flex-1 flex flex-col min-h-0"
                    tabListClassName="px-3 pt-0 pb-0 bg-transparent"
                    contentClassName="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-panel-border hover:scrollbar-thumb-text-secondary/50"
                    variant="default"
                    fullWidth
                    data-testid="left-panel-tabs"
                  />
              </div>
            </m.div>
          )}
        </AnimatePresence>
        
        {/* Collapsed Vertical Text/Icons */}
        {isCollapsed && (
           <m.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.2 }}
             className="flex-1 flex flex-col items-center py-4 gap-4"
           >
              <div className="writing-vertical-rl text-xs font-bold text-text-tertiary tracking-widest uppercase opacity-50 select-none">
                Space & Object
              </div>
           </m.div>
        )}
    </m.div>
  );
};
