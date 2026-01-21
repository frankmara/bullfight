import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

let createChart: any = null;
let CandlestickSeries: any = null;
if (Platform.OS === 'web') {
  try {
    const lwc = require('lightweight-charts');
    createChart = lwc.createChart;
    CandlestickSeries = lwc.CandlestickSeries;
  } catch (e) {
    console.error('Failed to load lightweight-charts', e);
  }
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Position {
  id: string;
  pair: string;
  side: string;
  quantityUnits: number;
  avgEntryPrice: number;
  unrealizedPnlCents: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

interface PendingOrder {
  id: string;
  pair: string;
  side: string;
  type: string;
  quantityUnits: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

interface TradingViewChartProps {
  pair: string;
  height?: number;
  positions?: Position[];
  orders?: PendingOrder[];
}

export const TradingViewChart = React.forwardRef<any, TradingViewChartProps>(
  ({ pair, height = 400, positions = [], orders = [] }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const candlestickSeriesRef = useRef<any>(null);
    const priceLinesRef = useRef<any[]>([]);
    const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastDataRef = useRef<CandleData | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    const generateInitialData = (pair: string): CandleData[] => {
      const basePrice = getBasePrice(pair);
      const data: CandleData[] = [];
      const now = Math.floor(Date.now() / 1000);
      const candleSize = 60;

      for (let i = 50; i >= 0; i--) {
        const time = now - i * candleSize;
        const volatility = 0.0005;
        const randomWalk = (Math.random() - 0.5) * 0.001;
        const close = basePrice + randomWalk;
        const open = close + (Math.random() - 0.5) * volatility;
        const high = Math.max(open, close) + Math.random() * volatility;
        const low = Math.min(open, close) - Math.random() * volatility;

        data.push({
          time,
          open: Math.round(open * 100000) / 100000,
          high: Math.round(high * 100000) / 100000,
          low: Math.round(low * 100000) / 100000,
          close: Math.round(close * 100000) / 100000,
        });
      }

      return data;
    };

    const getBasePrice = (pairSymbol: string): number => {
      const prices: Record<string, number> = {
        'EUR-USD': 1.0875,
        'GBP-USD': 1.2650,
        'USD-JPY': 149.5,
        'AUD-USD': 0.652,
        'USD-CAD': 1.358,
      };
      return prices[pairSymbol] || 1.0;
    };

    const generateNewCandle = (pair: string, lastCandle: CandleData | null): CandleData => {
      const basePrice = getBasePrice(pair);
      const now = Math.floor(Date.now() / 1000);
      const candleSize = 60;

      if (!lastCandle) {
        const volatility = 0.0005;
        const randomWalk = (Math.random() - 0.5) * 0.001;
        const close = basePrice + randomWalk;
        const open = close + (Math.random() - 0.5) * volatility;
        const high = Math.max(open, close) + Math.random() * volatility;
        const low = Math.min(open, close) - Math.random() * volatility;

        return {
          time: Math.floor(now / candleSize) * candleSize,
          open: Math.round(open * 100000) / 100000,
          high: Math.round(high * 100000) / 100000,
          low: Math.round(low * 100000) / 100000,
          close: Math.round(close * 100000) / 100000,
        };
      }

      const volatility = 0.0005;
      const randomWalk = (Math.random() - 0.5) * 0.001;
      const close = lastCandle.close + randomWalk;
      const open = lastCandle.close;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      const candleTime = Math.floor(now / candleSize) * candleSize;

      return {
        time: candleTime,
        open: Math.round(open * 100000) / 100000,
        high: Math.round(high * 100000) / 100000,
        low: Math.round(low * 100000) / 100000,
        close: Math.round(close * 100000) / 100000,
      };
    };

    useEffect(() => {
      if (!isClient || Platform.OS !== 'web' || !createChart || !containerRef.current) {
        return;
      }

      try {
        const chart = createChart(containerRef.current, {
          layout: {
            background: { color: Colors.dark.backgroundRoot },
            textColor: Colors.dark.textSecondary,
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
          },
          width: containerRef.current.clientWidth,
          height,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: Colors.dark.border,
          },
          rightPriceScale: {
            borderColor: Colors.dark.border,
            textColor: Colors.dark.textSecondary,
          },
          grid: {
            horzLines: {
              color: `${Colors.dark.border}50`,
              visible: true,
            },
            vertLines: {
              color: `${Colors.dark.border}50`,
              visible: true,
            },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: Colors.dark.textMuted,
              labelBackgroundColor: Colors.dark.backgroundSecondary,
            },
            horzLine: {
              color: Colors.dark.textMuted,
              labelBackgroundColor: Colors.dark.backgroundSecondary,
            },
          },
        });

        chartRef.current = chart;

        const candlestickSeries = CandlestickSeries 
          ? chart.addSeries(CandlestickSeries, {
              upColor: Colors.dark.success,
              downColor: Colors.dark.danger,
              borderUpColor: Colors.dark.success,
              borderDownColor: Colors.dark.danger,
              wickUpColor: Colors.dark.success,
              wickDownColor: Colors.dark.danger,
            })
          : chart.addCandlestickSeries({
              upColor: Colors.dark.success,
              downColor: Colors.dark.danger,
              borderUpColor: Colors.dark.success,
              borderDownColor: Colors.dark.danger,
              wickUpColor: Colors.dark.success,
              wickDownColor: Colors.dark.danger,
            });

        candlestickSeriesRef.current = candlestickSeries;

        const initialData = generateInitialData(pair);
        candlestickSeries.setData(initialData);
        lastDataRef.current = initialData[initialData.length - 1];

        chart.timeScale().fitContent();

        updateIntervalRef.current = setInterval(() => {
          if (candlestickSeriesRef.current && lastDataRef.current) {
            const newCandle = generateNewCandle(pair, lastDataRef.current);
            if (newCandle.time >= lastDataRef.current.time) {
              try {
                candlestickSeriesRef.current.update(newCandle);
                lastDataRef.current = newCandle;
              } catch (e) {
              }
            }
          }
        }, 5000);

        const handleResize = () => {
          if (containerRef.current && chart) {
            chart.applyOptions({
              width: containerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
          }
          if (chart) {
            chart.remove();
          }
        };
      } catch (error) {
        console.error('Error initializing TradingView chart:', error);
      }
    }, [isClient, pair, height]);

    useEffect(() => {
      if (!isClient || Platform.OS !== 'web' || !candlestickSeriesRef.current) {
        return;
      }

      const newData = generateInitialData(pair);
      candlestickSeriesRef.current.setData(newData);
      lastDataRef.current = newData[newData.length - 1];

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }, [pair, isClient]);

    useEffect(() => {
      if (!candlestickSeriesRef.current || Platform.OS !== 'web') {
        return;
      }

      priceLinesRef.current.forEach((line) => {
        try {
          candlestickSeriesRef.current.removePriceLine(line);
        } catch (e) {
        }
      });
      priceLinesRef.current = [];

      positions.forEach((pos) => {
        try {
          const entryLine = candlestickSeriesRef.current.createPriceLine({
            price: pos.avgEntryPrice,
            color: pos.side === 'buy' ? Colors.dark.success : Colors.dark.danger,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `${pos.side.toUpperCase()} ${pos.quantityUnits.toLocaleString()}`,
          });
          priceLinesRef.current.push(entryLine);

          if (pos.stopLossPrice) {
            const slLine = candlestickSeriesRef.current.createPriceLine({
              price: pos.stopLossPrice,
              color: '#FF6B6B',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: 'SL',
            });
            priceLinesRef.current.push(slLine);
          }

          if (pos.takeProfitPrice) {
            const tpLine = candlestickSeriesRef.current.createPriceLine({
              price: pos.takeProfitPrice,
              color: '#4ECDC4',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: 'TP',
            });
            priceLinesRef.current.push(tpLine);
          }
        } catch (e) {
          console.error('Error creating position price line:', e);
        }
      });

      orders.forEach((order) => {
        try {
          const orderPrice = order.limitPrice || order.stopPrice;
          if (!orderPrice) return;

          const orderLine = candlestickSeriesRef.current.createPriceLine({
            price: orderPrice,
            color: Colors.dark.accent,
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: `${order.type.toUpperCase()} ${order.side.toUpperCase()}`,
          });
          priceLinesRef.current.push(orderLine);

          if (order.stopLossPrice) {
            const slLine = candlestickSeriesRef.current.createPriceLine({
              price: order.stopLossPrice,
              color: '#FF6B6B',
              lineWidth: 1,
              lineStyle: 3,
              axisLabelVisible: false,
              title: '',
            });
            priceLinesRef.current.push(slLine);
          }

          if (order.takeProfitPrice) {
            const tpLine = candlestickSeriesRef.current.createPriceLine({
              price: order.takeProfitPrice,
              color: '#4ECDC4',
              lineWidth: 1,
              lineStyle: 3,
              axisLabelVisible: false,
              title: '',
            });
            priceLinesRef.current.push(tpLine);
          }
        } catch (e) {
          console.error('Error creating order price line:', e);
        }
      });
    }, [positions, orders]);

    if (Platform.OS !== 'web') {
      return (
        <View style={styles.nativePlaceholder}>
          <Text style={styles.nativePlaceholderText}>
            Charts are only available on web. Please access the trading arena from your desktop browser.
          </Text>
        </View>
      );
    }

    return React.createElement('div', {
      ref: containerRef,
      style: {
        width: '100%',
        height,
        backgroundColor: Colors.dark.backgroundRoot,
        borderRadius: 0,
        overflow: 'hidden',
      },
    });
  }
);

TradingViewChart.displayName = 'TradingViewChart';

const styles = StyleSheet.create({
  nativePlaceholder: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: 8,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  nativePlaceholderText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
