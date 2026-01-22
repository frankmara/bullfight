import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TerminalColors } from '@/components/terminal';
import { getApiUrl } from '@/lib/query-client';

let createChart: any = null;
let CandlestickSeries: any = null;
let CrosshairMode: any = null;
if (Platform.OS === 'web') {
  try {
    const lwc = require('lightweight-charts');
    createChart = lwc.createChart;
    CandlestickSeries = lwc.CandlestickSeries;
    CrosshairMode = lwc.CrosshairMode;
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

interface Quote {
  bid: number;
  ask: number;
}

interface TradingViewChartProps {
  pair: string;
  height?: number;
  positions?: Position[];
  orders?: PendingOrder[];
  timeframe?: string;
  currentQuote?: Quote;
}

const TIMEFRAME_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1D': 86400,
};

function formatPrice(price: number, pair: string): string {
  const decimals = pair.includes('JPY') ? 3 : 5;
  return price.toFixed(decimals);
}

export const TradingViewChart = React.forwardRef<any, TradingViewChartProps>(
  ({ pair, height = 400, positions = [], orders = [], timeframe = '15m', currentQuote }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const candlestickSeriesRef = useRef<any>(null);
    const priceLinesRef = useRef<any[]>([]);
    const lastDataRef = useRef<CandleData | null>(null);
    const candlesRef = useRef<CandleData[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isMockData, setIsMockData] = useState(false);
    const [ohlcData, setOhlcData] = useState<CandleData | null>(null);

    useEffect(() => {
      setIsClient(true);
    }, []);

    const fetchCandles = useCallback(async (): Promise<CandleData[]> => {
      try {
        const url = new URL(`/api/market/candles`, getApiUrl());
        url.searchParams.set('pair', pair);
        url.searchParams.set('tf', timeframe);
        url.searchParams.set('limit', '500');
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Failed to fetch candles');
        
        const data = await response.json();
        setIsMockData(data.mock === true);
        return data.candles || [];
      } catch (e) {
        console.error('Error fetching candles:', e);
        return [];
      }
    }, [pair, timeframe]);

    const updateLastCandle = useCallback((quote: Quote) => {
      if (!candlestickSeriesRef.current || !lastDataRef.current) return;
      
      const mid = (quote.bid + quote.ask) / 2;
      const now = Math.floor(Date.now() / 1000);
      const candleSeconds = TIMEFRAME_SECONDS[timeframe] || 60;
      const currentBucket = Math.floor(now / candleSeconds) * candleSeconds;
      
      const lastCandle = lastDataRef.current;
      
      if (lastCandle.time === currentBucket) {
        const updatedCandle: CandleData = {
          ...lastCandle,
          close: mid,
          high: Math.max(lastCandle.high, mid),
          low: Math.min(lastCandle.low, mid),
        };
        try {
          candlestickSeriesRef.current.update(updatedCandle);
          lastDataRef.current = updatedCandle;
          setOhlcData(updatedCandle);
        } catch (e) {}
      } else {
        const newCandle: CandleData = {
          time: currentBucket,
          open: lastCandle.close,
          high: mid,
          low: mid,
          close: mid,
        };
        try {
          candlestickSeriesRef.current.update(newCandle);
          lastDataRef.current = newCandle;
          candlesRef.current.push(newCandle);
          setOhlcData(newCandle);
        } catch (e) {}
      }
    }, [timeframe]);

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
              background: { color: TerminalColors.bgBase },
              textColor: TerminalColors.textMuted,
              fontFamily: "'Inter', 'SF Pro', system-ui, sans-serif",
              fontSize: 11,
            },
            width: containerRef.current.clientWidth,
            height,
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
              borderColor: TerminalColors.border,
              barSpacing: 6,
              rightOffset: 5,
            },
            rightPriceScale: {
              borderColor: TerminalColors.border,
              scaleMargins: {
                top: 0.1,
                bottom: 0.1,
              },
              mode: 0,
              autoScale: true,
            },
            grid: {
              horzLines: {
                color: TerminalColors.bgElevated,
                visible: true,
              },
              vertLines: {
                color: TerminalColors.bgElevated,
                visible: true,
              },
            },
            crosshair: {
              mode: CrosshairMode?.Normal || 0,
              vertLine: {
                color: TerminalColors.textMuted,
                width: 1,
                style: 3,
                labelBackgroundColor: TerminalColors.bgPanel,
              },
              horzLine: {
                color: TerminalColors.textMuted,
                width: 1,
                style: 3,
                labelBackgroundColor: TerminalColors.bgPanel,
              },
            },
            handleScale: {
              mouseWheel: true,
              pinch: true,
            },
            handleScroll: {
              mouseWheel: true,
              pressedMouseMove: true,
            },
          });

          if (!isMounted) {
            chart.remove();
            return;
          }

          chartRef.current = chart;

          const candlestickSeries = CandlestickSeries 
            ? chart.addSeries(CandlestickSeries, {
                upColor: TerminalColors.positive,
                downColor: TerminalColors.negative,
                borderUpColor: TerminalColors.positive,
                borderDownColor: TerminalColors.negative,
                wickUpColor: TerminalColors.positive,
                wickDownColor: TerminalColors.negative,
                priceFormat: {
                  type: 'price',
                  precision: pair.includes('JPY') ? 3 : 5,
                  minMove: pair.includes('JPY') ? 0.001 : 0.00001,
                },
                lastValueVisible: true,
                priceLineVisible: true,
                priceLineWidth: 1,
                priceLineColor: TerminalColors.accent,
                priceLineStyle: 2,
              })
            : chart.addCandlestickSeries({
                upColor: TerminalColors.positive,
                downColor: TerminalColors.negative,
                borderUpColor: TerminalColors.positive,
                borderDownColor: TerminalColors.negative,
                wickUpColor: TerminalColors.positive,
                wickDownColor: TerminalColors.negative,
                priceFormat: {
                  type: 'price',
                  precision: pair.includes('JPY') ? 3 : 5,
                  minMove: pair.includes('JPY') ? 0.001 : 0.00001,
                },
              });

          candlestickSeriesRef.current = candlestickSeries;

          const candles = await fetchCandles();
          if (!isMounted) return;
          
          if (candles.length > 0) {
            candlestickSeries.setData(candles);
            candlesRef.current = candles;
            lastDataRef.current = candles[candles.length - 1];
            setOhlcData(candles[candles.length - 1]);
          }

          chart.timeScale().fitContent();
          setIsLoading(false);

          chart.subscribeCrosshairMove((param: any) => {
            if (!param || !param.time || !param.seriesData) return;
            const data = param.seriesData.get(candlestickSeries);
            if (data) {
              setOhlcData(data as CandleData);
            }
          });

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
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    }, [isClient, pair, height, timeframe, fetchCandles]);

    useEffect(() => {
      if (currentQuote && candlestickSeriesRef.current) {
        updateLastCandle(currentQuote);
      }
    }, [currentQuote, updateLastCandle]);

    useEffect(() => {
      if (!candlestickSeriesRef.current || Platform.OS !== 'web') {
        return;
      }

      priceLinesRef.current.forEach((line) => {
        try {
          candlestickSeriesRef.current.removePriceLine(line);
        } catch (e) {}
      });
      priceLinesRef.current = [];

      positions.forEach((pos) => {
        try {
          const lots = pos.quantityUnits / 100000;
          const lotsDisplay = lots >= 0.01 ? lots.toFixed(2) : (lots * 100).toFixed(0) + 'K';
          const entryLine = candlestickSeriesRef.current.createPriceLine({
            price: pos.avgEntryPrice,
            color: pos.side === 'buy' ? TerminalColors.positive : TerminalColors.negative,
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
            color: TerminalColors.accent,
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

    const pctChange = ohlcData ? ((ohlcData.close - ohlcData.open) / ohlcData.open) * 100 : 0;
    const isPositive = pctChange >= 0;

    return React.createElement('div', {
      ref: containerRef,
      style: {
        width: '100%',
        height,
        backgroundColor: TerminalColors.bgBase,
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative',
      },
    }, [
      React.createElement('div', {
        key: 'ohlc-overlay',
        style: {
          position: 'absolute',
          top: 8,
          left: 12,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'none',
        },
      }, [
        React.createElement('span', {
          key: 'symbol',
          style: {
            color: TerminalColors.textPrimary,
            fontSize: 13,
            fontWeight: 600,
          },
        }, `${pair.replace('-', '/')} ${timeframe}`),
        isMockData && React.createElement('span', {
          key: 'mock-badge',
          style: {
            color: TerminalColors.warning,
            fontSize: 10,
            fontWeight: 700,
            backgroundColor: `${TerminalColors.warning}20`,
            padding: '2px 6px',
            borderRadius: 3,
          },
        }, 'MOCK DATA'),
        ohlcData && React.createElement('div', {
          key: 'ohlc-values',
          style: {
            display: 'flex',
            gap: 8,
            fontSize: 11,
            fontVariant: 'tabular-nums',
          },
        }, [
          React.createElement('span', { key: 'o', style: { color: TerminalColors.textMuted } }, 'O'),
          React.createElement('span', { key: 'ov', style: { color: TerminalColors.textSecondary } }, formatPrice(ohlcData.open, pair)),
          React.createElement('span', { key: 'h', style: { color: TerminalColors.textMuted } }, 'H'),
          React.createElement('span', { key: 'hv', style: { color: TerminalColors.textSecondary } }, formatPrice(ohlcData.high, pair)),
          React.createElement('span', { key: 'l', style: { color: TerminalColors.textMuted } }, 'L'),
          React.createElement('span', { key: 'lv', style: { color: TerminalColors.textSecondary } }, formatPrice(ohlcData.low, pair)),
          React.createElement('span', { key: 'c', style: { color: TerminalColors.textMuted } }, 'C'),
          React.createElement('span', { key: 'cv', style: { color: isPositive ? TerminalColors.positive : TerminalColors.negative } }, formatPrice(ohlcData.close, pair)),
          React.createElement('span', { 
            key: 'pct', 
            style: { 
              color: isPositive ? TerminalColors.positive : TerminalColors.negative,
              marginLeft: 4,
            } 
          }, `${isPositive ? '+' : ''}${pctChange.toFixed(2)}%`),
        ]),
      ]),
      isLoading && React.createElement('div', {
        key: 'loading',
        style: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: TerminalColors.textMuted,
          fontSize: 12,
        },
      }, 'Loading chart...'),
    ]);
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
