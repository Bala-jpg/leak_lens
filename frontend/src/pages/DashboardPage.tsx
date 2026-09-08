import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { ActiveLeakBanner } from '../components/dashboard/ActiveLeakBanner';
import { NormalStateBanner } from '../components/dashboard/NormalStateBanner';
import { FlowMetricsGrid } from '../components/dashboard/FlowMetricsGrid';
import { FlowChart } from '../components/dashboard/FlowChart';
import { WaterImpactCard } from '../components/dashboard/WaterImpactCard';
import { RecentIncidentsTable } from '../components/dashboard/RecentIncidentsTable';

export const DashboardPage: React.FC = () => {
  const { isLeakActive } = useTelemetry();

  return (
    <div className="w-full pb-8 max-w-7xl mx-auto">
      {/* 1. Alert / Normal State Banner */}
      {isLeakActive ? <ActiveLeakBanner /> : <NormalStateBanner />}

      {/* 2. Four Connected Metric Cards */}
      <FlowMetricsGrid />

      {/* 3. Realtime Flow Trend Chart */}
      <FlowChart />

      {/* 4. Impact Summary & Incident Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <WaterImpactCard />
        </div>
        <div className="lg:col-span-6">
          <RecentIncidentsTable />
        </div>
      </div>
    </div>
  );
};
