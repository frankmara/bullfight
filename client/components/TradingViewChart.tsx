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

interface DrawnLine {
  id: string;
  type: "horizontal" | "trend" | "vertical" | "ray";
  price?: number;
  startPrice?: number;
  startTime?: number;
  endPrice?: number;
  endTime?: number;
  color: string;
}

interface DragInfo {
  positionId: string;
  type: 'sl' | 'tp';
  originalPrice: number;
  newPrice: number;
}

interface TradingViewChartProps {
  pair: string;
  height?: number;
  positions?: Position[];
  orders?: PendingOrder[];
  timeframe?: string;
  currentQuote?: Quote;
  selectedTool?: string;
  drawnLines?: DrawnLine[];
  onChartClick?: (price: number, time: number) => void;
  onSLTPDrag?: (dragInfo: DragInfo) => void;
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

interface DraggableLine {
  positionId: string;
  type: 'sl' | 'tp';
  price: number;
  lineRef: any;
}

export const TradingViewChart = React.forwardRef<any, TradingViewChartProps>(
  ({ pair, height = 400, positions = [], orders = [], timeframe = '15m', currentQuote, selectedTool = 'cursor', drawnLines = [], onChartClick, onSLTPDrag }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const candlestickSeriesRef = useRef<any>(null);
    const priceLinesRef = useRef<any[]>([]);
    const drawnLinesRef = useRef<any[]>([]);
    const draggableLinesRef = useRef<DraggableLine[]>([]);
    const lastDataRef = useRef<CandleData | null>(null);
    const candlesRef = useRef<CandleData[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isMockData, setIsMockData] = useState(false);
    const [ohlcData, setOhlcData] = useState<CandleData | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragTarget, setDragTarget] = useState<DraggableLine | null>(null);
    const [dragPrice, setDragPrice] = useState<number | null>(null);

    useEffect(() => {
      setIsClient(true);
    }, []);

    const fetchCandles = useCallback(async (): Promise<CandleData[]> => {
      try {
        const url = new URL(`/api/market/candles`, getApiUrl());
        url.searchParams.set('pair', pair);
        url.searchParams.set('tf', timeframe);
        url.searchParams.set('limit', '1000');
        
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
                borderVisible: false,
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
                borderVisible: false,
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

          chart.subscribeClick((param: any) => {
            if (!param || !param.point || !candlestickSeriesRef.current) return;
            try {
              const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
              const time = chartRef.current.timeScale().coordinateToTime(param.point.x);
              if (price && time && onChartClick) {
                onChartClick(price, time);
              }
            } catch (e) {
              console.error('Error getting chart coordinates:', e);
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
      draggableLinesRef.current = [];

      positions.forEach((pos) => {
        try {
          const lots = pos.quantityUnits / 100000;
          const lotsDisplay = lots.toFixed(2);
          const priceDisplay = formatPrice(pos.avgEntryPrice, pos.pair);
          const isLong = pos.side === 'buy';
          
          const entryLine = candlestickSeriesRef.current.createPriceLine({
            price: pos.avgEntryPrice,
            color: isLong ? '#16C784' : '#EA3943',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${pos.side.toUpperCase()} ${lotsDisplay} @ ${priceDisplay}`,
          });
          priceLinesRef.current.push(entryLine);

          if (pos.stopLossPrice) {
            const slPriceDisplay = formatPrice(pos.stopLossPrice, pos.pair);
            const slLine = candlestickSeriesRef.current.createPriceLine({
              price: pos.stopLossPrice,
              color: '#EA3943',
              lineWidth: 2,
              lineStyle: 1,
              axisLabelVisible: true,
              title: `⬍ SL ${slPriceDisplay}`,
            });
            priceLinesRef.current.push(slLine);
            draggableLinesRef.current.push({
              positionId: pos.id,
              type: 'sl',
              price: pos.stopLossPrice,
              lineRef: slLine,
            });
          }

          if (pos.takeProfitPrice) {
            const tpPriceDisplay = formatPrice(pos.takeProfitPrice, pos.pair);
            const tpLine = candlestickSeriesRef.current.createPriceLine({
              price: pos.takeProfitPrice,
              color: '#16C784',
              lineWidth: 2,
              lineStyle: 1,
              axisLabelVisible: true,
              title: `⬍ TP ${tpPriceDisplay}`,
            });
            priceLinesRef.current.push(tpLine);
            draggableLinesRef.current.push({
              positionId: pos.id,
              type: 'tp',
              price: pos.takeProfitPrice,
              lineRef: tpLine,
            });
          }
        } catch (e) {
          console.error('Error creating position price line:', e);
        }
      });

      orders.forEach((order) => {
        try {
          const orderPrice = order.limitPrice || order.stopPrice;
          if (!orderPrice) return;

          const lots = order.quantityUnits / 100000;
          const lotsDisplay = lots.toFixed(2);
          const priceDisplay = formatPrice(orderPrice, order.pair);
          const orderTypeLabel = order.type.toUpperCase();
          const sideLabel = order.side.toUpperCase();
          const isLong = order.side === 'buy';

          const orderLine = candlestickSeriesRef.current.createPriceLine({
            price: orderPrice,
            color: '#FFA726',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: `${orderTypeLabel} ${sideLabel} ${lotsDisplay} @ ${priceDisplay}`,
          });
          priceLinesRef.current.push(orderLine);

          if (order.stopLossPrice) {
            const slPriceDisplay = formatPrice(order.stopLossPrice, order.pair);
            const slLine = candlestickSeriesRef.current.createPriceLine({
              price: order.stopLossPrice,
              color: '#EA3943',
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: true,
              title: `SL ${slPriceDisplay}`,
            });
            priceLinesRef.current.push(slLine);
          }

          if (order.takeProfitPrice) {
            const tpPriceDisplay = formatPrice(order.takeProfitPrice, order.pair);
            const tpLine = candlestickSeriesRef.current.createPriceLine({
              price: order.takeProfitPrice,
              color: '#16C784',
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: true,
              title: `TP ${tpPriceDisplay}`,
            });
            priceLinesRef.current.push(tpLine);
          }
        } catch (e) {
          console.error('Error creating order price line:', e);
        }
      });
    }, [positions, orders, pair]);

    useEffect(() => {
      if (!containerRef.current || !candlestickSeriesRef.current || Platform.OS !== 'web') {
        return;
      }

      const container = containerRef.current;
      const DRAG_THRESHOLD = 8;

      const findNearestDraggableLine = (y: number): DraggableLine | null => {
        if (!candlestickSeriesRef.current) return null;
        
        let closestLine: DraggableLine | null = null;
        let minDist = Infinity;

        for (const dragLine of draggableLinesRef.current) {
          try {
            const lineY = candlestickSeriesRef.current.priceToCoordinate(dragLine.price);
            if (lineY !== null) {
              const dist = Math.abs(y - lineY);
              if (dist < minDist && dist < DRAG_THRESHOLD) {
                minDist = dist;
                closestLine = dragLine;
              }
            }
          } catch (e) {}
        }
        return closestLine;
      };

      const handleMouseDown = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const line = findNearestDraggableLine(y);
        
        if (line) {
          e.preventDefault();
          e.stopPropagation();
          setDragTarget(line);
          setDragPrice(line.price);
          setIsDragging(true);
          container.style.cursor = 'ns-resize';
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !dragTarget || !candlestickSeriesRef.current) {
          const rect = container.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const line = findNearestDraggableLine(y);
          container.style.cursor = line ? 'ns-resize' : 'crosshair';
          return;
        }

        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        try {
          const newPrice = candlestickSeriesRef.current.coordinateToPrice(y);
          if (newPrice !== null && newPrice > 0) {
            setDragPrice(newPrice);
            dragTarget.lineRef.applyOptions({
              price: newPrice,
              title: `⬍ ${dragTarget.type.toUpperCase()} ${formatPrice(newPrice, pair)} (dragging)`,
            });
          }
        } catch (e) {}
      };

      const handleMouseUp = () => {
        if (isDragging && dragTarget && dragPrice !== null && dragPrice !== dragTarget.price) {
          if (onSLTPDrag) {
            onSLTPDrag({
              positionId: dragTarget.positionId,
              type: dragTarget.type,
              originalPrice: dragTarget.price,
              newPrice: dragPrice,
            });
          }
        } else if (isDragging && dragTarget) {
          dragTarget.lineRef.applyOptions({
            price: dragTarget.price,
            title: `⬍ ${dragTarget.type.toUpperCase()} ${formatPrice(dragTarget.price, pair)}`,
          });
        }
        setIsDragging(false);
        setDragTarget(null);
        setDragPrice(null);
        container.style.cursor = 'crosshair';
      };

      container.addEventListener('mousedown', handleMouseDown, { capture: true });
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseUp);

      return () => {
        container.removeEventListener('mousedown', handleMouseDown, { capture: true });
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseUp);
      };
    }, [isDragging, dragTarget, dragPrice, pair, onSLTPDrag]);

    useEffect(() => {
      if (!candlestickSeriesRef.current || Platform.OS !== 'web') {
        return;
      }

      drawnLinesRef.current.forEach((line) => {
        try {
          candlestickSeriesRef.current.removePriceLine(line);
        } catch (e) {}
      });
      drawnLinesRef.current = [];

      drawnLines.forEach((line) => {
        try {
          if (line.type === 'horizontal' && line.price) {
            const priceLine = candlestickSeriesRef.current.createPriceLine({
              price: line.price,
              color: line.color,
              lineWidth: 1,
              lineStyle: 0,
              axisLabelVisible: true,
              title: 'H-Line',
            });
            drawnLinesRef.current.push(priceLine);
          }
        } catch (e) {
          console.error('Error creating drawn line:', e);
        }
      });
    }, [drawnLines]);

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
