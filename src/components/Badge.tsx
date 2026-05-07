import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  label: string;
  color?: string;
}

export function Badge({ label, color = Colors.accentBlue }: Props) {
  return (
    <View style={[styles.badge, { borderColor: color + '40', backgroundColor: color + '18' }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
