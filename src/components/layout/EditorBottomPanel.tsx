import React from 'react';
import { TimelineControls } from './TimelineControls';

export const EditorBottomPanel: React.FC = () => {
    return (
        <div className="shrink-0 z-10 flex flex-col pointer-events-none" data-testid="editor-bottom-panel">
           <div className="pointer-events-auto">
                <TimelineControls />
           </div>
        </div>
    );
};
