import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import { parseScBuffer, ScFile } from '../src/utils/ScParser';
import { Badge } from '../src/components/Badge';
import { SectionHeader } from '../src/components/SectionHeader';

const TABS = ['Exports', 'Shapes', 'Textures', 'Matrices', 'Info'] as const;
type Tab = typeof TABS[number];

export default function ViewerScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [scFile, setScFile] = useState<ScFile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<Tab>('Exports');

  const fileName = decodeURIComponent(uri ?? '').split('/').pop() ?? 'File';

  useEffect(() => {
    if (!uri) return;
    (async () => {
      try {
        setLoading(true);
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const parsed = parseScBuffer(binary, uri);
        setScFile(parsed);
      } catch (e: any) {
        setError(e.message ?? 'Failed to parse file');
      } finally {
        setLoading(false);
      }
    })();
  }, [uri]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.accentYellow} />
      <Text style={styles.loadingText}>Parsing SC file…</Text>
    </View>
  );

  if (error || !scFile) return (
    <View style={styles.center}>
      <Ionicons name="warning-outline" size={48} color={Colors.accentRed} />
      <Text style={styles.errorTitle}>Failed to parse file</Text>
      <Text style={styles.errorMsg}>{error}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: fileName }} />

      {/* Info banner */}
      <View style={styles.banner}>
        <Badge label={`v${scFile.version}`} color={Colors.accentBlue} />
        <Badge label={scFile.compression} color={Colors.accentGreen ?? Colors.accentBlue} />
        <Badge label={`${scFile.exports.length} exports`} color={Colors.accentYellow} />
        <Badge label={`${scFile.textures.length} tex`} color={Colors.accentBlue} />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {tab === 'Exports'  && <ExportsList scFile={scFile} uri={uri!} />}
      {tab === 'Shapes'   && <ShapesList scFile={scFile} />}
      {tab === 'Textures' && <TexturesList scFile={scFile} />}
      {tab === 'Matrices' && <MatricesList scFile={scFile} />}
      {tab === 'Info'     && <InfoTab scFile={scFile} />}
    </View>
  );
}

function ExportsList({ scFile, uri }: { scFile: ScFile; uri: string }) {
  if (scFile.exports.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>No exports found</Text>
    </View>
  );
  return (
    <FlatList
      data={scFile.exports}
      keyExtractor={e => String(e.id)}
      contentContainerStyle={styles.listPad}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row}
          onPress={() => router.push({ pathname: '/editor', params: { uri, exportId: item.id } })}
          activeOpacity={0.75}>
          <View style={styles.rowIcon}>
            <Ionicons name="film-outline" size={22} color={Colors.accentYellow} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSub}>ID: {item.id}  ·  Movieclip: {item.movieclipId}</Text>
          </View>
          <Ionicons name="pencil-outline" size={16} color={Colors.accentBlue} />
        </TouchableOpacity>
      )}
    />
  );
}

function ShapesList({ scFile }: { scFile: ScFile }) {
  return (
    <FlatList
      data={scFile.shapes}
      keyExtractor={s => String(s.id)}
      contentContainerStyle={styles.listPad}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Ionicons name="layers-outline" size={22} color={Colors.accentBlue} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Shape #{item.id}</Text>
            <Text style={styles.rowSub}>{item.chunks.length} chunk(s)</Text>
          </View>
        </View>
      )}
    />
  );
}

function TexturesList({ scFile }: { scFile: ScFile }) {
  return (
    <FlatList
      data={scFile.textures}
      keyExtractor={t => String(t.index)}
      contentContainerStyle={styles.listPad}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Ionicons name="image-outline" size={22} color={Colors.accentYellow} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Texture #{item.index}</Text>
            <Text style={styles.rowSub}>{item.width}×{item.height}  {item.pixelFormat}</Text>
          </View>
          <Badge label={item.pixelFormat} color={Colors.accentBlue} />
        </View>
      )}
    />
  );
}

function MatricesList({ scFile }: { scFile: ScFile }) {
  return (
    <FlatList
      data={scFile.matrices}
      keyExtractor={m => String(m.id)}
      contentContainerStyle={styles.listPad}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item: m }) => (
        <View style={styles.row}>
          <Ionicons name="grid-outline" size={22} color={Colors.accentBlue} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Matrix #{m.id}</Text>
            <Text style={styles.rowSub}>
              [{m.a.toFixed(2)}, {m.b.toFixed(2)}, {m.c.toFixed(2)}, {m.d.toFixed(2)}]{'\n'}
              tx={m.tx.toFixed(1)}  ty={m.ty.toFixed(1)}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

function InfoTab({ scFile }: { scFile: ScFile }) {
  const rows = [
    ['Version',     `v${scFile.version}`],
    ['Compression', scFile.compression],
    ['Exports',     String(scFile.exports.length)],
    ['Movieclips',  String(scFile.movieclips.length)],
    ['Shapes',      String(scFile.shapes.length)],
    ['Textures',    String(scFile.textures.length)],
    ['Matrices',    String(scFile.matrices.length)],
    ['ColorSpaces', String(scFile.colorSpaces.length)],
    ['TextFields',  String(scFile.textFields.length)],
  ];
  return (
    <ScrollView contentContainerStyle={styles.listPad}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.background },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText:  { color: Colors.onDarkSecondary, marginTop: 8 },
  errorTitle:   { color: Colors.accentRed, fontSize: 16, fontWeight: '700' },
  errorMsg:     { color: Colors.onDarkSecondary, fontSize: 12, textAlign: 'center' },
  backBtn:      { marginTop: 8, backgroundColor: Colors.card, borderRadius: 10,
                  paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText:  { color: Colors.onDark, fontWeight: '600' },
  banner:       { flexDirection: 'row', gap: 8, padding: 12,
                  backgroundColor: Colors.card, flexWrap: 'wrap' },
  tabBar:       { maxHeight: 44, backgroundColor: Colors.surface },
  tabBarContent:{ paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tab:          { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: Colors.accentYellow },
  tabText:      { color: Colors.onDarkSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive:{ color: Colors.accentYellow },
  listPad:      { padding: 16, gap: 0 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: Colors.card, borderRadius: 12, padding: 14 },
  rowIcon:      { width: 38, height: 38, borderRadius: 9, backgroundColor: Colors.surface,
                  alignItems: 'center', justifyContent: 'center' },
  rowInfo:      { flex: 1 },
  rowTitle:     { color: Colors.onDark, fontSize: 14, fontWeight: '600' },
  rowSub:       { color: Colors.onDarkSecondary, fontSize: 11, marginTop: 2 },
  emptyText:    { color: Colors.onDarkSecondary },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between',
                  backgroundColor: Colors.card, borderRadius: 10,
                  paddingHorizontal: 16, paddingVertical: 12, marginBottom: 6 },
  infoLabel:    { color: Colors.onDarkSecondary, fontSize: 13 },
  infoValue:    { color: Colors.accentYellow, fontSize: 13, fontWeight: '600' },
});
