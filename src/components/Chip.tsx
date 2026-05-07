import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface Props { label: string; color?: string; }

export function Chip({ label, color = Colors.blue }: Props) {
  return (
    <View style={[styles.chip, { borderColor: color + '44' }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
});
