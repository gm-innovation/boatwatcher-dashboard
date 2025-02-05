
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4 animate-fade-in">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse">
            {/* Company Logo Placeholder */}
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              {format(currentTime, 'HH:mm:ss')}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {format(currentTime, 'dd/MM/yyyy')}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse">
            {/* Client Logo Placeholder */}
          </div>
        </div>
      </div>
    </header>
  );
};
