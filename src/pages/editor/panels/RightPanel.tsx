import { useState } from 'react';
import { useEditor } from '@/store/editorStore';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';

export function RightPanel() {
  const [tab, setTab] = useState<'layers' | 'properties'>('layers');
  const open = useEditor((s) => s.rightPanelOpen);

  return (
    <aside className={`right-panel ${open ? 'is-open' : ''}`}>
      <div className="panel-tabs">
        <button className={tab === 'layers' ? 'is-active' : ''} onClick={() => setTab('layers')}>
          Layers
        </button>
        <button className={tab === 'properties' ? 'is-active' : ''} onClick={() => setTab('properties')}>
          Properties
        </button>
      </div>
      <div className="right-panel__scroll">
        {tab === 'layers' ? (
          <>
            <LayersPanel />
            <PropertiesPanel />
          </>
        ) : (
          <PropertiesPanel />
        )}
      </div>
    </aside>
  );
}
