import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

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
  timeframe?: string;
  currentPrice?: number;
}

export const TradingViewChart = React.forwardRef<any, TradingViewChartProps>(
  ({ pair, height = 400, positions = [], orders = [], timeframe = '1m', currentPrice }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const candlestickSeriesRef = useRef<any>(null);
    const priceLinesRef = useRef<any[]>([]);
    const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastDataRef = useRef<CandleData | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dataStatus, setDataStatus] = useState<'live' | 'mock'>('mock');

    useEffect(() => {
      setIsClient(true);
    }, []);

    const fetchCandles = useCallback(async (): Promise<CandleData[]> => {
      try {
        const url = new URL(`/api/market/candles/${pair}`, getApiUrl());
        url.searchParams.set('timeframe', timeframe);
        url.searchParams.set('limit', '500');
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Failed to fetch candles');
        
        const data = await response.json();
        setDataStatus(data.isUsingMock ? 'mock' : 'live');
        return data.candles || [];
      } catch (e) {
        console.error('Error fetching candles:', e);
        return [];
      }
    }, [pair, timeframe]);

    const updateLastCandle = useCallback((price: number) => {
      if (!candlestickSeriesRef.current || !lastDataRef.current) return;
      
      const now = Math.floor(Date.now() / 1000);
      const candleSeconds = 60;
      const currentBucket = Math.floor(now / candleSeconds) * candleSeconds;
      
      const lastCandle = lastDataRef.current;
      
      if (lastCandle.time === currentBucket) {
        const updatedCandle = {
          ...lastCandle,
          close: price,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
        };
        try {
          candlestickSeriesRef.current.update(updatedCandle);
          lastDataRef.current = updatedCandle;
        } catch (e) {}
      } else {
        const newCandle: CandleData = {
          time: currentBucket,
          open: lastCandle.close,
          high: price,
          low: price,
          close: price,
        };
        try {
          candlestickSeriesRef.current.update(newCandle);
          lastDataRef.current = newCandle;
        } catch (e) {}
      }
    }, []);

    useEffect(() => {
      if (!isClient || Platform.OS !== 'web' || !createChart || !containerRef.current) {
        return;
      }

      let isMounted = true;

      const initChart = async () => {
        if (!containerRef.current) return;
        
        setIsLoading(true);

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

          if (!isMounted) {
            chart.remove();
            return;
          }

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

          const candles = await fetchCandles();
          if (!isMounted) return;
          
          if (candles.length > 0) {
            candlestickSeries.setData(candles);
            lastDataRef.current = candles[candles.length - 1];
          }

          chart.timeScale().fitContent();
          setIsLoading(false);

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
          };
        } catch (error) {
          console.error('Error initializing TradingView chart:', error);
          setIsLoading(false);
        }
      };

      initChart();

      return () => {
        isMounted = false;
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
        }
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    }, [isClient, pair, height, timeframe, fetchCandles]);

    useEffect(() => {
      if (currentPrice && candlestickSeriesRef.current) {
        updateLastCandle(currentPrice);
      }
    }, [currentPrice, updateLastCandle]);

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
          const lots = pos.quantityUnits / 100000;
          const lotsDisplay = lots >= 0.01 ? lots.toFixed(2) : (lots * 100).toFixed(0) + 'K';
          const entryLine = candlestickSeriesRef.current.createPriceLine({
            price: pos.avgEntryPrice,
            color: pos.side === 'buy' ? Colors.dark.success : Colors.dark.danger,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `${pos.side.toUpperCase()} ${lotsDisplay} lots`,
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
