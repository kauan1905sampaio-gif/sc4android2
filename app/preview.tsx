import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { ScStore } from '../src/parser/ScStore';
import { prepareAnimationData, buildAnimationHtml } from '../src/parser/AnimationRenderer';
import type { ScFile } from '../src/parser/ScParser';

export default function PreviewScreen() {
  const { exportId } = useLocalSearchParams<{ exportId: string }>();
  const nav = useNavigation();

  const [html, setHtml]       = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [building, setBuilding] = useState(true);

  const build = useCallback(() => {
    const scFile = ScStore.get();
    const expId  = parseInt(exportId ?? '0');
    const exp    = scFile?.exports.find(e => e.id === expId);
    const mc     = scFile?.movieclips.find(m => m.id === exp?.movieclipId);

    nav.setOptions({ title: exp ? `Preview: ${exp.name}` : 'Preview' });

    if (!scFile || !mc) {
      setError('Export not found.');
      setBuilding(false);
      return;
    }
    if (mc.frames.length === 0) {
      setError('This movieclip has no frames to preview.');
      setBuilding(false);
      return;
    }

    // Run on next tick so UI can show spinner first
    setTimeout(() => {
      try {
        setBuilding(true);
        setError(null);
        const data = prepareAnimationData(scFile, mc);
        setHtml(buildAnimationHtml(data));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBuilding(false);
      }
    }, 50);
  }, [exportId]);

  useEffect(() => { build(); }, [build]);

  if (building) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.yellow} />
        <Text style={styles.hint}>Building animation preview…</Text>
        <Text style={styles.sub}>Converting textures and mapping shapes</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={48} color={Colors.red} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={build}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.infoBar}>
        <Ionicons name="film-outline" size={14} color={Colors.yellow} />
        <Text style={styles.infoText}>
          Use Play/Pause and arrow buttons inside the preview to control playback
        </Text>
      </View>
      <WebView
        style={styles.webview}
        source={{ html: html! }}
        originWhitelist={['*']}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled={false}
        mixedContentMode="always"
        onError={e => setError(e.nativeEvent.description)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hint:      { color: Colors.onDark, fontSize: 15, marginTop: 12 },
  sub:       { color: Colors.onDarkSub, fontSize: 12, textAlign: 'center' },
  errorText: { color: Colors.red, fontSize: 14, textAlign: 'center', marginTop: 8 },
  retryBtn:  { backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: Colors.cardBorder, marginTop: 8 },
  retryText: { color: Colors.onDark, fontWeight: '600' },
  infoBar:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  infoText:  { color: Colors.onDarkSub, fontSize: 11, flex: 1 },
  webview:   { flex: 1, backgroundColor: Colors.bg },
});
