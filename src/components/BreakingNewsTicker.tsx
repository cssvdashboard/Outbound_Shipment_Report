import React from 'react';
import {
  AlertTriangle,
  Calendar,
  Radio
} from 'lucide-react';

interface BreakingNewsTickerProps {
  shipments?: any[];
  rawShipments?: any[];
}

interface AlertItem {
  id: string;
  tag: string;
  tagBg: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  headline: string;
  detail: string;
}

export const BreakingNewsTicker: React.FC<BreakingNewsTickerProps> = () => {
  // Specific user-requested operational disruption and holiday alerts
  const baseBulletins: AlertItem[] = [
    {
      id: 'disruption-italy',
      tag: 'SERVICE DISRUPTION',
      tagBg: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
      icon: AlertTriangle,
      iconColor: 'text-rose-400',
      headline: 'Service Disruption Update (09/08/2026) -',
      detail:
        'FedEx Italy is experiencing temporary service disruptions due to an operational contingency involving the area of Piacenza.'
    },
    {
      id: 'holiday-japan',
      tag: 'HOLIDAY ALERT',
      tagBg: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
      icon: Calendar,
      iconColor: 'text-amber-400',
      headline: 'Holiday Alert -',
      detail: 'Japan will remain closed till 09/23/2026.'
    }
  ];

  // Repeat items to provide a continuous, seamless looping stream across all screen widths
  const sequence = [...baseBulletins, ...baseBulletins, ...baseBulletins, ...baseBulletins];
  const duplicatedItems = [...sequence, ...sequence];

  return (
    <div className="w-full bg-white/95 dark:bg-[#070d18]/95 border-y-2 border-amber-400/60 dark:border-amber-500/30 backdrop-blur-md print:hidden shadow-xs transition-colors">
      <div className="w-full px-2 sm:px-4 flex items-center h-10 relative overflow-hidden">
        
        {/* Left Fixed Breaking Live Intel Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 h-7 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-black text-[11px] uppercase tracking-wider rounded-lg shrink-0 select-none z-20 shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <Radio className="w-3.5 h-3.5 animate-pulse hidden xs:inline" />
          <span className="font-extrabold tracking-tight">LIVE INTEL</span>
        </div>

        {/* Left fade gradient mask */}
        <div className="pointer-events-none absolute left-[96px] sm:left-[118px] top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-[#070d18] to-transparent z-10" />

        {/* Smooth, leisurely-paced continuous scrolling track */}
        <div className="overflow-hidden relative flex-1 flex items-center h-full">
          <div className="animate-ticker-ltr flex items-center py-1">
            {duplicatedItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="inline-flex items-center gap-2.5 sm:gap-3 px-5 sm:px-8 text-xs whitespace-nowrap cursor-default select-text group"
                >
                  {/* Category Pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${item.tagBg}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                    <span>{item.tag}</span>
                  </span>

                  {/* Headline & Notice Text */}
                  <div className="inline-flex items-baseline gap-1.5 text-slate-800 dark:text-slate-200">
                    <span className="font-black text-slate-900 dark:text-white">
                      {item.headline}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.detail}
                    </span>
                  </div>

                  {/* Bulletin Separator */}
                  <span className="text-amber-500/60 dark:text-amber-400/40 select-none font-bold text-sm ml-3">
                    ◆
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right fade gradient mask */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[#070d18] to-transparent z-10" />
      </div>
    </div>
  );
};
