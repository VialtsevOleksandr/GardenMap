import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const SIDE_PAD = 16;
const GAP = 6;

function daysRemaining(crop) {
  if (!crop?.plantedAt) return null;
  const planted = crop.plantedAt.toDate ? crop.plantedAt.toDate() : new Date(crop.plantedAt);
  const harvestMs = planted.getTime() + crop.harvestDays * 86400000;
  return Math.ceil((harvestMs - Date.now()) / 86400000);
}

function cellTheme(crop) {
  if (!crop) {
    return { bg: '#e8f5e9', border: '#a5d6a7', label: '#388e3c', bar: '#81c784' };
  }
  const d = daysRemaining(crop);
  if (d == null) return { bg: '#c8e6c9', border: '#66bb6a', label: '#2e7d32', bar: '#43a047' };
  if (d <= 0)    return { bg: '#ffcdd2', border: '#ef9a9a', label: '#b71c1c', bar: '#e53935' };
  if (d <= 7)    return { bg: '#fff9c4', border: '#fff176', label: '#e65100', bar: '#fb8c00' };
  return         { bg: '#c8e6c9', border: '#66bb6a', label: '#2e7d32', bar: '#43a047' };
}

function daysLabel(crop) {
  if (!crop) return null;
  const d = daysRemaining(crop);
  if (d == null) return null;
  if (d <= 0) return '🍅';
  if (d <= 7) return `${d}д!`;
  return `${d}д`;
}

function progressPct(crop) {
  const d = daysRemaining(crop);
  if (d == null || !crop?.harvestDays) return 0;
  return Math.max(0, Math.min(100, (1 - d / crop.harvestDays) * 100));
}

export default function BedGrid({ beds, cropsByBed, onPressBed, rows, cols }) {
  const cellSize = Math.floor((SCREEN_W - SIDE_PAD * 2 - GAP * (cols - 1)) / cols);
  const cellHeight = Math.max(cellSize * 0.85, 56);
  const fontSize = cols >= 6 ? 9 : cols >= 5 ? 10 : 11;

  const bedMap = useMemo(() => {
    const m = {};
    beds.forEach(b => {
      if (!m[b.row]) m[b.row] = {};
      m[b.row][b.col] = b;
    });
    return m;
  }, [beds]);

  return (
    <View style={[styles.grid, { paddingHorizontal: SIDE_PAD }]}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={[styles.row, { marginBottom: GAP }]}>
          {Array.from({ length: cols }, (_, c) => {
            const bed = bedMap[r]?.[c];
            const crop = bed ? cropsByBed?.[bed.id] : null;
            const theme = cellTheme(crop);
            const pct = crop ? progressPct(crop) : 0;
            const dl = crop ? daysLabel(crop) : null;

            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellHeight,
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    marginRight: c < cols - 1 ? GAP : 0,
                  },
                ]}
                onPress={() => bed && onPressBed(bed)}
                activeOpacity={0.7}
              >
                {bed ? (
                  <>
                    <Text style={[styles.bedLabel, { color: theme.label, fontSize: fontSize + 1 }]}>
                      {bed.label}
                    </Text>

                    {crop ? (
                      <>
                        <Text
                          style={[styles.cropName, { color: theme.label, fontSize }]}
                          numberOfLines={1}
                        >
                          {crop.name}
                        </Text>
                        {dl && (
                          <Text style={[styles.daysText, { color: theme.label, fontSize: fontSize + 1 }]}>
                            {dl}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={[styles.emptyIcon, { color: theme.label }]}>🌱</Text>
                    )}

                    <View style={styles.barBg}>
                      <View
                        style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.bar }]}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={styles.noCell}>─</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingBottom: 8 },
  row: { flexDirection: 'row' },
  cell: {
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bedLabel: {
    fontWeight: '800',
    letterSpacing: 0.3,
    opacity: 0.75,
  },
  cropName: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  daysText: {
    fontWeight: '700',
    marginTop: 1,
  },
  emptyIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  barBg: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 2,
    marginTop: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  noCell: {
    fontSize: 14,
    color: '#ccc',
  },
});
