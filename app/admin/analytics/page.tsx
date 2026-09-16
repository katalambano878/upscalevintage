'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiData } from '@/lib/client/api';
import { money } from '@/lib/format-money';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type AnalyticsPayload = {
  metrics: {
    revenue: number;
    revenueGrowth: number;
    orders: number;
    ordersGrowth: number;
    aov: number;
    aovGrowth: number;
    paidRate: number;
    paidRateGrowth: number;
    discountTotal: number;
    ordersAll: number;
  };
  sales: { date: string; sales: number; orders: number }[];
  topProducts: { name: string; units: number; revenue: number }[];
  categories: { name: string; value: number }[];
};

function growthLabel(n: number) {
  if (!n) return '0% vs prior';
  return `${n > 0 ? '+' : ''}${n}% vs prior`;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await apiData<AnalyticsPayload>(`/api/admin/analytics?range=${timeRange}`);
      setData(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const metrics = data?.metrics;
  const salesData = data?.sales || [];
  const categoryRevenue = data?.categories || [];
  const topProducts = data?.topProducts || [];

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      'Metric,Value',
      `Revenue,${data.metrics.revenue}`,
      `Paid orders,${data.metrics.orders}`,
      `All orders,${data.metrics.ordersAll}`,
      `AOV,${data.metrics.aov}`,
      `Paid rate,${data.metrics.paidRate}`,
      `Discount total,${data.metrics.discountTotal}`,
      '',
      'Date,Sales,Orders',
      ...data.sales.map((row) => `${row.date},${row.sales},${row.orders}`),
      '',
      'Product,Units,Revenue',
      ...data.topProducts.map((p) => `"${p.name.replace(/"/g, '""')}",${p.units},${p.revenue}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upscale-analytics-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-sans tracking-normal">
              Advanced Analytics
            </h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base font-sans tracking-normal">
              Detailed insights and performance metrics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-store-primary focus:border-store-primary font-medium pr-8 cursor-pointer bg-white"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="year">This Year</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data}
              className="bg-store-navy hover:bg-store-navy text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center disabled:opacity-50"
            >
              <i className="ri-download-line mr-2"></i>
              Export
            </button>
            <Link
              href="/admin"
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center"
            >
              Back
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}

        {loading || !metrics ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-loader-4-line animate-spin text-3xl mb-2 inline-block"></i>
            <p>Loading analytics…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-store-surface rounded-lg">
                    <i className="ri-money-dollar-circle-line text-2xl text-store-ink"></i>
                  </div>
                  <span className="text-store-ink font-semibold text-sm">{growthLabel(metrics.revenueGrowth)}</span>
                </div>
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">GH₵{money(metrics.revenue)}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-store-surface rounded-lg">
                    <i className="ri-shopping-cart-line text-2xl text-store-ink"></i>
                  </div>
                  <span className="text-store-ink font-semibold text-sm">{growthLabel(metrics.ordersGrowth)}</span>
                </div>
                <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.orders}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-store-primary/15 rounded-lg">
                    <i className="ri-bar-chart-box-line text-2xl text-store-primary"></i>
                  </div>
                  <span className="text-store-ink font-semibold text-sm">{growthLabel(metrics.aovGrowth)}</span>
                </div>
                <p className="text-sm text-gray-600 mb-1">Avg. Order Value</p>
                <p className="text-3xl font-bold text-gray-900">GH₵{money(metrics.aov)}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-amber-100 rounded-lg">
                    <i className="ri-percent-line text-2xl text-amber-700"></i>
                  </div>
                  <span className="text-store-ink font-semibold text-sm">{growthLabel(metrics.paidRateGrowth)}</span>
                </div>
                <p className="text-sm text-gray-600 mb-1">Paid Rate</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.paidRate}%</p>
                <p className="text-xs text-gray-400 mt-1">
                  Paid orders ÷ all orders ({metrics.orders}/{metrics.ordersAll})
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 font-sans tracking-normal">
                  Revenue & Performance Trends
                </h2>
              </div>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <AreaChart data={salesData.length > 0 ? salesData : [{ date: 'No Data', sales: 0 }]}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorSales)"
                      name="Sales (GH₵)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 font-sans tracking-normal">
                  Revenue by Category
                </h2>
                <div className="flex items-center justify-center mb-6">
                  <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={categoryRevenue.length > 0 ? categoryRevenue : [{ name: 'No Data', value: 1 }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryRevenue.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 font-sans tracking-normal">
                  Top Performing Products
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="text-left pb-3 text-sm font-semibold text-gray-600">Product</th>
                        <th className="text-right pb-3 text-sm font-semibold text-gray-600">Units</th>
                        <th className="text-right pb-3 text-sm font-semibold text-gray-600">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topProducts.map((product) => (
                        <tr key={product.name}>
                          <td className="py-3 text-sm font-medium text-gray-900">{product.name}</td>
                          <td className="py-3 text-right text-sm text-gray-600">{product.units}</td>
                          <td className="py-3 text-right text-sm font-semibold text-store-muted">
                            GH₵{money(product.revenue)}
                          </td>
                        </tr>
                      ))}
                      {topProducts.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-gray-500">
                            No sales data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
