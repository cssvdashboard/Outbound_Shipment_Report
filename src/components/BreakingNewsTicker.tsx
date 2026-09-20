import React, { useState, useMemo } from 'react';
import {
  Zap,
  Scale,
  Building2,
  ShieldCheck,
  Globe,
  PackageCheck,
  Award,
  Plane,
  Pause,
  Play,
  ArrowRight,
  ArrowLeft,
  Flame,
  Radio,
  Sparkles
} from 'lucide-react';
import { Shipment } from '../types/logistics';

interface BreakingNewsTickerProps {
  shipments: Shipment[];
  rawShipments?: Shipment[];
}

interface BulletinItem {
  id: string;
  tag: string;
  tagBg: string;
  tagText: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  headline: string;
  detail: string;
}

export const BreakingNewsTicker: React.FC<BreakingNewsTickerProps> = ({
  shipments,
  rawShipments = []
}) => {
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scrollDirection, setScrollDirection] = useState<'ltr' | 'rtl'>('ltr');

  const effectiveShipments = useMemo(() => {
    return shipments && shipments.length > 0 ? shipments : rawShipments;
  }, [shipments, rawShipments]);

  // Compute live unshared intelligence from the dataset
  const bulletins: BulletinItem[] = useMemo(() => {
    if (!effectiveShipments || effectiveShipments.length === 0) return [];

    const total = effectiveShipments.length;
    const items: BulletinItem[] = [];

    // 1. FASTEST SINGLE DELIVERY RECORD
    let fastest: { awb: string; tt: number; dest: string; city: string; shpr: string } | null = null;
    let heaviest: { awb: string; weight: number; dest: string; customer: string } | null = null;
    let cleanCount = 0;
    let totalPkgs = 0;
    let agentCount = 0;
    let ppCount = 0;
    let ccCount = 0;

    const cityMap: Record<string, { count: number; onTime: number }> = {};
    const destSet = new Set<string>();
    const gatewaySet = new Set<string>();
    const shipperMap: Record<string, { count: number; onTime: number }> = {};
    const countryTTMap: Record<string, { count: number; sumTT: number }> = {};

    for (let i = 0; i < total; i++) {
      const s = effectiveShipments[i];

      // Fastest
      if (s.finalResolution === 'Delivered' && s.tt > 0) {
        if (!fastest || s.tt < fastest.tt) {
          fastest = {
            awb: s.awb,
            tt: s.tt,
            dest: s.destination || '',
            city: s.city || '',
            shpr: s.shprName || ''
          };
        }
      }

      // Heaviest
      const w = s.weight || 0;
      if (!heaviest || w > heaviest.weight) {
        heaviest = {
          awb: s.awb,
          weight: w,
          dest: s.destination || '',
          customer: s.customer || ''
        };
      }

      // Clean Run (Zero delays)
      const hasClearance = Boolean(s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '');
      const hasTransit = Boolean(s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '');
      const hasDest = Boolean(s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '');
      const wd = (s.weekendDelay || '').toString().toLowerCase().trim();
      const hasWeekend = wd === 'yes' || wd === '1' || wd === 'true';
      if (!hasClearance && !hasTransit && !hasDest && !hasWeekend) {
        cleanCount++;
      }

      // Packages
      totalPkgs += (s.pkgCount || 0);

      // Channels
      if (s.isAgent) agentCount++;
      const type = (s.shipmentType || '').toUpperCase();
      if (type === 'PP') ppCount++;
      else if (type === 'CC') ccCount++;

      // Destinations & Hubs
      if (s.destination) destSet.add(s.destination.toUpperCase().trim());
      if (s.destLocCd && s.destLocCd !== '-' && s.destLocCd.trim() !== '') {
        gatewaySet.add(s.destLocCd.toUpperCase().trim());
      }

      // City Aggregation
      const cityName = (s.city || '').trim();
      if (cityName && cityName.toUpperCase() !== 'UNKNOWN' && cityName.toUpperCase() !== 'N/A' && cityName !== '-') {
        if (!cityMap[cityName]) cityMap[cityName] = { count: 0, onTime: 0 };
        cityMap[cityName].count++;
        if (s.tt > 0 && s.tt <= 5) cityMap[cityName].onTime++;
      }

      // Shipper Aggregation
      const shpr = (s.shprName || '').trim();
      if (shpr && shpr !== '-' && shpr.toUpperCase() !== 'UNKNOWN') {
        if (!shipperMap[shpr]) shipperMap[shpr] = { count: 0, onTime: 0 };
        shipperMap[shpr].count++;
        if (s.tt > 0 && s.tt <= 5) shipperMap[shpr].onTime++;
      }

      // Country TT Aggregation
      const destCode = (s.destination || '').toUpperCase().trim();
      if (destCode && destCode !== 'UNKNOWN' && s.tt > 0) {
        if (!countryTTMap[destCode]) countryTTMap[destCode] = { count: 0, sumTT: 0 };
        countryTTMap[destCode].count++;
        countryTTMap[destCode].sumTT += s.tt;
      }
    }

    // 1. SPEED RECORD
    if (fastest) {
      items.push({
        id: 'speed-record',
        tag: 'SPEED RECORD',
        tagBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
        tagText: 'text-emerald-700 dark:text-emerald-300',
        icon: Zap,
        iconColor: 'text-emerald-500',
        headline: `Record Delivery in ${fastest.tt}d:`,
        detail: `AWB #${fastest.awb} delivered in record time to ${fastest.city || fastest.dest} (${fastest.dest}) via ${fastest.shpr}`
      });
    }

    // 2. HEAVIEST CONSIGNMENT
    if (heaviest && heaviest.weight > 0) {
      const tons = (heaviest.weight / 1000).toFixed(2);
      items.push({
        id: 'heaviest-cargo',
        tag: 'HEAVIEST CARGO',
        tagBg: 'bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400',
        tagText: 'text-purple-700 dark:text-purple-300',
        icon: Scale,
        iconColor: 'text-purple-500',
        headline: `Max Weight Consignment:`,
        detail: `AWB #${heaviest.awb} grossed ${heaviest.weight.toLocaleString()} kg (${tons} Tons) to ${heaviest.dest} (${heaviest.customer})`
      });
    }

    // 3. ZERO DELAY CLEAN-RUN RELIABILITY
    const cleanRate = total > 0 ? ((cleanCount / total) * 100).toFixed(2) : '0';
    items.push({
      id: 'clean-run',
      tag: 'CLEAN RUN',
      tagBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
      tagText: 'text-cyan-700 dark:text-cyan-300',
      icon: ShieldCheck,
      iconColor: 'text-cyan-500',
      headline: `Zero-Exception Run Rate:`,
      detail: `${cleanRate}% of shipments (${cleanCount.toLocaleString()} AWBs) completed transit without any airline, customs, or weekend delay`
    });

    // 4. TOP DESTINATION CITY HUB
    let topCity: { name: string; count: number; onTimePct: number } | null = null;
    for (const [name, d] of Object.entries(cityMap)) {
      if (!topCity || d.count > topCity.count) {
        topCity = {
          name,
          count: d.count,
          onTimePct: Math.round((d.onTime / d.count) * 1000) / 10
        };
      }
    }
    if (topCity) {
      items.push({
        id: 'top-city',
        tag: 'TOP CITY HUB',
        tagBg: 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400',
        tagText: 'text-blue-700 dark:text-blue-300',
        icon: Building2,
        iconColor: 'text-blue-500',
        headline: `Busiest Destination City:`,
        detail: `${topCity.name} handled ${topCity.count.toLocaleString()} consignments with ${topCity.onTimePct}% on-time SLA`
      });
    }

    // 5. GLOBAL GATEWAY NETWORK FOOTPRINT
    items.push({
      id: 'global-network',
      tag: 'GLOBAL REACH',
      tagBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
      tagText: 'text-indigo-700 dark:text-indigo-300',
      icon: Globe,
      iconColor: 'text-indigo-500',
      headline: `Worldwide Cargo Pipelines:`,
      detail: `Active shipments dispatched to ${destSet.size} sovereign countries across ${gatewaySet.size} international gateway facilities`
    });

    // 6. TOTAL INDIVIDUAL PACKAGE UNITS HANDLED
    if (totalPkgs > 0) {
      items.push({
        id: 'package-volume',
        tag: 'CARGO UNITS',
        tagBg: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400',
        tagText: 'text-amber-700 dark:text-amber-300',
        icon: PackageCheck,
        iconColor: 'text-amber-500',
        headline: `Total Package Tally:`,
        detail: `${totalPkgs.toLocaleString()} individual cartons and packages safely handled and delivered through the network`
      });
    }

    // 7. FREIGHT COMMERCIAL MIX
    const agentPct = total > 0 ? ((agentCount / total) * 100).toFixed(1) : '0';
    const ppPct = total > 0 ? ((ppCount / total) * 100).toFixed(1) : '0';
    items.push({
      id: 'commercial-mix',
      tag: 'COMMERCIAL MIX',
      tagBg: 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400',
      tagText: 'text-teal-700 dark:text-teal-300',
      icon: Flame,
      iconColor: 'text-teal-500',
      headline: `Commercial Channels:`,
      detail: `${agentCount.toLocaleString()} Agency freight bookings (${agentPct}% share) | ${ppCount.toLocaleString()} Prepaid (PP, ${ppPct}%)`
    });

    // 8. RELIABILITY CHAMPION SHIPPER
    let topShipper: { name: string; count: number; onTimePct: number } | null = null;
    for (const [name, d] of Object.entries(shipperMap)) {
      if (d.count >= 40) {
        const pct = Math.round((d.onTime / d.count) * 1000) / 10;
        if (!topShipper || pct > topShipper.onTimePct || (pct === topShipper.onTimePct && d.count > topShipper.count)) {
          topShipper = { name, count: d.count, onTimePct: pct };
        }
      }
    }
    if (topShipper) {
      items.push({
        id: 'top-shipper',
        tag: 'SLA CHAMPION',
        tagBg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400',
        tagText: 'text-rose-700 dark:text-rose-300',
        icon: Award,
        iconColor: 'text-rose-500',
        headline: `Reliability Benchmark:`,
        detail: `${topShipper.name} achieved ${topShipper.onTimePct}% on-time SLA across ${topShipper.count.toLocaleString()} consignments`
      });
    }

    // 9. FASTEST DESTINATION TRADE CORRIDOR
    let fastestCountry: { code: string; count: number; avgTT: number } | null = null;
    for (const [code, d] of Object.entries(countryTTMap)) {
      if (d.count >= 30) {
        const avg = Math.round((d.sumTT / d.count) * 100) / 100;
        if (!fastestCountry || avg < fastestCountry.avgTT) {
          fastestCountry = { code, count: d.count, avgTT: avg };
        }
      }
    }
    if (fastestCountry) {
      items.push({
        id: 'fastest-lane',
        tag: 'TOP SPEED CORRIDOR',
        tagBg: 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400',
        tagText: 'text-sky-700 dark:text-sky-300',
        icon: Plane,
        iconColor: 'text-sky-500',
        headline: `Fastest Trade Lane:`,
        detail: `${fastestCountry.code} corridor averaging ${fastestCountry.avgTT} days transit time across ${fastestCountry.count.toLocaleString()} shipments`
      });
    }

    return items;
  }, [effectiveShipments]);

  if (bulletins.length === 0) return null;

  // Duplicate for smooth seamless continuous infinite loop
  const duplicatedBulletins = [...bulletins, ...bulletins];

  return (
    <div className="max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 my-1.5 print:hidden">
      <div className="relative flex items-center bg-white/90 dark:bg-slate-900/90 rounded-2xl border-2 border-amber-400/60 dark:border-amber-500/40 shadow-sm shadow-amber-500/5 backdrop-blur-md overflow-hidden h-10 transition-colors">
        
        {/* Left Fixed Breaking Intel Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 h-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-black text-[11px] uppercase tracking-wider shrink-0 select-none z-20 shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <Radio className="w-3.5 h-3.5 animate-pulse hidden xs:inline" />
          <span className="font-extrabold tracking-tight">LIVE INTEL</span>
        </div>

        {/* Left fade gradient mask */}
        <div className="pointer-events-none absolute left-[90px] sm:left-[110px] top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10" />

        {/* Scrolling Ticker Track */}
        <div className="overflow-hidden relative flex-1 flex items-center h-full">
          <div
            className={`${
              scrollDirection === 'ltr' ? 'animate-ticker-ltr' : 'animate-ticker-rtl'
            } ${isPaused ? 'ticker-paused' : ''} flex items-center py-1`}
          >
            {duplicatedBulletins.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="inline-flex items-center gap-2 sm:gap-2.5 px-4 sm:px-6 text-xs whitespace-nowrap cursor-default group"
                >
                  {/* Category Pill */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${item.tagBg}`}
                  >
                    <Icon className={`w-3 h-3 ${item.iconColor}`} />
                    <span>{item.tag}</span>
                  </span>

                  {/* Headline & Detail */}
                  <div className="inline-flex items-baseline gap-1 text-slate-800 dark:text-slate-200">
                    <span className="font-black text-slate-900 dark:text-white">
                      {item.headline}
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {item.detail}
                    </span>
                  </div>

                  {/* Bulletin Separator */}
                  <span className="text-slate-300 dark:text-slate-700 select-none font-bold text-sm ml-2">
                    ◆
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right fade gradient mask */}
        <div className="pointer-events-none absolute right-[70px] sm:right-[85px] top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10" />

        {/* Right Controls: Direction Toggle & Pause/Play */}
        <div className="flex items-center gap-1 px-2.5 h-full bg-slate-100/90 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setScrollDirection(prev => (prev === 'ltr' ? 'rtl' : 'ltr'))}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={`Switch Direction (Currently: ${scrollDirection === 'ltr' ? 'Left to Right' : 'Right to Left'})`}
          >
            {scrollDirection === 'ltr' ? (
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsPaused(prev => !prev)}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={isPaused ? 'Resume Ticker' : 'Pause Ticker'}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
