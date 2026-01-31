import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapViz from './components/MapViz';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(384); // 384px = w-96
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= 300 && newWidth <= 700) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  return (
    <div className="h-screen w-screen bg-black flex overflow-hidden relative">
      {/* Sidebar */}
      <div
        className={`relative transition-all duration-300 ease-in-out flex-shrink-0 ${isCollapsed ? 'w-0' : ''
          }`}
        style={{ width: isCollapsed ? 0 : `${sidebarWidth}px` }}
      >
        <div className={`h-full ${isCollapsed ? 'hidden' : 'block'}`}>
          <Sidebar />
        </div>

        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-transparent hover:bg-neon-blue/30 transition-colors group z-40"
            onMouseDown={handleMouseDown}
          >
            {/* Drag indicator */}
            <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-6 h-20 bg-neutral-700 group-hover:bg-neon-blue rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-10 bg-white/50 rounded-full"></div>
                <div className="w-0.5 h-10 bg-white/50 rounded-full"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-6 z-50 bg-gradient-to-r from-neon-blue to-neon-green hover:opacity-90 text-white p-3 rounded-r-xl shadow-2xl transition-all hover:shadow-neon-blue/50 flex items-center gap-2 group"
        style={{
          left: isCollapsed ? '0' : `${sidebarWidth - 2}px`,
          transition: 'left 300ms ease-in-out'
        }}
        title={isCollapsed ? 'Open Control Panel' : 'Close Control Panel'}
      >
        {isCollapsed ? (
          <>
            <ChevronRight size={20} />
            <span className="text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity max-w-0 group-hover:max-w-xs overflow-hidden">
              Open
            </span>
          </>
        ) : (
          <ChevronLeft size={20} />
        )}
      </button>

      {/* Map */}
      <div className="flex-1 h-full">
        <MapViz />
      </div>

      {/* Resize Overlay - prevents map from capturing mouse events while resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-50" style={{ cursor: 'col-resize' }} />
      )}
    </div>
  );
}

export default App;
