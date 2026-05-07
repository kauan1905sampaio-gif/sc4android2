import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.text}>{title}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: Colors.onDarkSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
});
