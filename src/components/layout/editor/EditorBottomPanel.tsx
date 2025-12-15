import React from 'react';
import { TimelineControls } from './TimelineControls';

export const EditorBottomPanel: React.FC = () => {
    return (
        <div className="bg-panel-bg border-t border-panel-border shrink-0 z-10 flex flex-col">
           <TimelineControls />
        </div>
    );
};
