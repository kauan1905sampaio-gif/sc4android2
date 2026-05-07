import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface Props { label: string; value: string; }

export function InfoRow({ label, value }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  label: { color: Colors.onDarkSub, fontSize: 12 },
  value: { color: Colors.yellow, fontSize: 12, fontWeight: '600' },
});
