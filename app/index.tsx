import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Pressable, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles } from '../src/utils/storage';
import { SectionHeader } from '../src/components/SectionHeader';
import { Badge } from '../src/components/Badge';

const FEATURES = [
  { icon: 'lock-closed-outline',  label: 'LZMA / ZSTD' },
  { icon: 'play-circle-outline',  label: 'View Exports' },
  { icon: 'image-outline',        label: 'Textures' },
  { icon: 'git-merge-outline',    label: 'Combine SC' },
  { icon: 'pencil-outline',       label: 'Live Edit' },
  { icon: 'download-outline',     label: 'Export PNG' },
] as const;

export default function HomeScreen() {
  const [recent, setRecent]     = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    getRecentFiles().then(setRecent);
  }, []);

  const openFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const updated = await addRecentFile(uri);
      setRecent(updated);
      router.push({ pathname: '/viewer', params: { uri } });
    } catch (e) {
      Alert.alert('Error', 'Could not open file');
    } finally {
      setLoading(false);
    }
  }, []);

  const openRecent = useCallback((uri: string) => {
    router.push({ pathname: '/viewer', params: { uri } });
  }, []);

  const removeRecent = useCallback(async (uri: string) => {
    const updated = await removeRecentFile(uri);
    setRecent(updated);
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert('Clear Recent', 'Remove all recent files?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => { await clearRecentFiles(); setRecent([]); }
      },
    ]);
  }, []);

  const fileName = (uri: string) =>
    decodeURIComponent(uri).split('/').pop() ?? uri;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SC Editor</Text>
          <Text style={styles.subtitle}>
            Clash of Clans · Clash Royale · Brawl Stars · Boom Beach
          </Text>
        </View>
        {recent.length > 0 && (
          <TouchableOpacity onPress={clearAll} hitSlop={12}>
            <Ionicons name="trash-outline" size={20} color={Colors.onDarkSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Feature chips */}
      <View style={styles.chips}>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.chip}>
            <Ionicons name={f.icon as any} size={13} color={Colors.accentBlue} />
            <Text style={styles.chipText}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent files */}
      <View style={styles.recentHeader}>
        {recent.length > 0 && <SectionHeader title="RECENT FILES" />}
      </View>

      {recent.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="folder-open-outline" size={64} color={Colors.onDarkSecondary} />
          <Text style={styles.emptyTitle}>No recent files</Text>
          <Text style={styles.emptySubtitle}>Tap the button below to open an SC file</Text>
        </View>
      ) : (
        <FlatList
          data={recent}
          keyExtractor={item => item}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openRecent(item)} activeOpacity={0.75}>
              <View style={styles.cardIcon}>
                <Ionicons name="document-outline" size={24} color={Colors.accentYellow} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{fileName(item)}</Text>
                <Text style={styles.cardPath} numberOfLines={1}>{item}</Text>
              </View>
              <TouchableOpacity onPress={() => removeRecent(item)} hitSlop={10}>
                <Ionicons name="close" size={18} color={Colors.onDarkSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openFile} activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color={Colors.background} />
          : <><Ionicons name="folder-open" size={20} color={Colors.background} />
              <Text style={styles.fabText}>Open SC File</Text></>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.background },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                   paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title:         { color: Colors.accentYellow, fontSize: 26, fontWeight: '800', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  subtitle:      { color: Colors.onDarkSecondary, fontSize: 11, marginTop: 4 },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 24 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5,
                   backgroundColor: Colors.card, borderRadius: 8,
                   paddingHorizontal: 10, paddingVertical: 6 },
  chipText:      { color: Colors.onDarkSecondary, fontSize: 11 },
  recentHeader:  { paddingHorizontal: 20 },
  list:          { paddingHorizontal: 20, paddingBottom: 100 },
  card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
                   borderRadius: 12, padding: 14, gap: 12 },
  cardIcon:      { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface,
                   alignItems: 'center', justifyContent: 'center' },
  cardInfo:      { flex: 1 },
  cardName:      { color: Colors.onDark, fontSize: 14, fontWeight: '600' },
  cardPath:      { color: Colors.onDarkSecondary, fontSize: 11, marginTop: 2 },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 100 },
  emptyTitle:    { color: Colors.onDarkSecondary, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: Colors.onDarkSecondary, fontSize: 12 },
  fab:           { position: 'absolute', bottom: 32, alignSelf: 'center',
                   flexDirection: 'row', alignItems: 'center', gap: 8,
                   backgroundColor: Colors.accentYellow, borderRadius: 50,
                   paddingHorizontal: 24, paddingVertical: 14,
                   shadowColor: Colors.accentYellow, shadowOffset: { width: 0, height: 4 },
                   shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabText:       { color: Colors.background, fontWeight: '700', fontSize: 15 },
});
