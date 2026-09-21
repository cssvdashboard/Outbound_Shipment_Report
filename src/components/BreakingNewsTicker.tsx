import React from 'react';
import {
  AlertTriangle,
  Calendar,
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
  // Specific user-requested operational disruption, holiday, and offload alerts
  const baseBulletins: AlertItem[] = [
    {
      id: 'disruption-italy',
      tag: 'SERVICE DISRUPTION',
      tagBg: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-300',
      icon: AlertTriangle,
      iconColor: 'text-rose-700 dark:text-rose-400',
      headline: '08.09.2026 \u00A0\u00A0 (FedEx Italy) -',
      detail:
        'Temporary service disruptions due to an operational contingency involving the area of Piacenza.'
    },
    {
      id: 'holiday-japan',
      tag: 'HOLIDAY ALERT',
      tagBg: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300',
      icon: Calendar,
      iconColor: 'text-amber-800 dark:text-amber-400',
      headline: '',
      detail: 'Japan will remain closed till 23.09.2026.'
    },
    {
      id: 'offload-tg322-16',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '16.09.2026 \u00A0\u00A0 (TG 322) -',
      detail: '306 kg (17 pcs) out of 631 kg yet to depart from BKK'
    },
    {
      id: 'offload-tg340-17',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '17.09.2026 \u00A0\u00A0 (TG 340) -',
      detail: '805 kg (96 pcs) out of 1300 kg yet to depart from BKK'
    },
    {
      id: 'offload-tg322-17',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '17.09.2026 \u00A0\u00A0 (TG 322) -',
      detail: '865 kg (101 pcs) out of 1600 kg yet to depart from BKK'
    },
    {
      id: 'offload-tg340-18',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '18.09.2026 \u00A0\u00A0 (TG 340) -',
      detail: '1185 kg (79 pcs) out of 2000 kg yet to depart from BKK'
    },
    {
      id: 'offload-tg322-19',
      tag: 'OFFLOAD STATUS',
      tagBg: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-300',
      icon: Plane,
      iconColor: 'text-orange-800 dark:text-orange-400',
      headline: '19.09.2026 \u00A0\u00A0 (TG 322) -',
      detail: 'Full 600 kg yet to depart from BKK'
    }
  ];

  // Repeat items to provide a continuous, seamless looping stream across all screen widths
  const sequence = [...baseBulletins, ...baseBulletins];
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
