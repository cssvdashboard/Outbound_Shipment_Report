import React from 'react';
import {
  AlertTriangle,
  Plane
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
  // Specific operational disruption, offload, and damage alerts
  const baseBulletins: AlertItem[] = [
    {
      id: 'offload-tg340-18',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '(TG 340) - 09/18/2026 -',
      detail: '1185 kg (80 pcs) are yet to depart from BKK. Scheduled for TG403 on 26th September.'
    },
    {
      id: 'offload-tg322-19',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '(TG 322) - 09/19/2026 -',
      detail: '600 kg (72 pcs) are yet to depart from BKK. Scheduled for TG403 on 26th September.'
    },
    {
      id: 'damage-singapore',
      tag: 'DAMAGE',
      tagBg: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-300',
      icon: AlertTriangle,
      iconColor: 'text-rose-700 dark:text-rose-400',
      headline: '',
      detail: '42 AWB was found damaged at Singapore.'
    }
  ];

  // Repeat items to provide a continuous, seamless looping stream across all screen widths
  const sequence = [...baseBulletins, ...baseBulletins, ...baseBulletins];
  const duplicatedItems = [...sequence, ...sequence];

  return (
    <div className="w-full bg-white/95 dark:bg-[#070d18]/95 border-y-2 border-amber-400/60 dark:border-amber-500/30 backdrop-blur-md print:hidden shadow-xs transition-colors">
      <div className="w-full px-2 sm:px-4 flex items-center h-12 relative overflow-hidden">
        
        {/* Left Fixed Compact Update Badge */}
        <div className="flex items-center gap-1.5 px-3 h-7 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-md shrink-0 select-none z-20 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="font-extrabold tracking-tight text-xs">UPDATE</span>
        </div>

        {/* Smooth, leisurely-paced continuous scrolling track (Right to Left) with crystal clear visibility */}
        <div className="overflow-hidden relative flex-1 flex items-center h-full ml-3">
          <div className="animate-ticker-rtl flex items-center py-1">
            {duplicatedItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="inline-flex items-center gap-3 px-6 sm:px-8 text-sm sm:text-[14.5px] whitespace-nowrap cursor-default select-text group"
                >
                  {/* Category Pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border shadow-2xs ${item.tagBg}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                    <span>{item.tag}</span>
                  </span>

                  {/* Headline & Notice Text */}
                  <div className="inline-flex items-baseline gap-2">
                    {item.headline ? (
                      <span className="font-bold text-slate-950 dark:text-white">
                        {item.headline}
                      </span>
                    ) : null}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {item.detail}
                    </span>
                  </div>

                  {/* Bulletin Separator */}
                  <span className="text-amber-500/80 dark:text-amber-400/60 select-none font-bold text-sm ml-3">
                    ◆
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
