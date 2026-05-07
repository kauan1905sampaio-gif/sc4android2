import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import { parseScBuffer, ScFile, Movieclip, MovieclipFrame, FrameElement, Matrix } from '../src/utils/ScParser';

export default function EditorScreen() {
  const { uri, exportId } = useLocalSearchParams<{ uri: string; exportId: string }>();
  const [scFile, setScFile]               = useState<ScFile | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [selectedElem, setSelectedElem]   = useState(-1);
  const [dx, setDx]                       = useState('0');
  const [dy, setDy]                       = useState('0');

  const expId = parseInt(exportId ?? '0', 10);

  useEffect(() => {
    if (!uri) return;
    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        setScFile(parseScBuffer(binary, uri));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uri]);

  const exp       = scFile?.exports.find(e => e.id === expId);
  const movieclip = scFile?.movieclips.find(m => m.id === exp?.movieclipId);
  const frame     = movieclip?.frames[selectedFrame];

  const applyMove = useCallback(() => {
    if (!scFile || !movieclip || selectedElem < 0 || !frame) return;
    const dxVal = parseFloat(dx) || 0;
    const dyVal = parseFloat(dy) || 0;
    const el = frame.elements[selectedElem];

    const existingMatrix = scFile.matrices[el.matrixIndex];
    let newMatrices = [...scFile.matrices];
    let newMatrixIndex = el.matrixIndex;

    if (existingMatrix?.a === 1 && existingMatrix.b === 0 &&
        existingMatrix.c === 0 && existingMatrix.d === 1) {
      // Accumulate
      newMatrices[el.matrixIndex] = {
        ...existingMatrix, tx: existingMatrix.tx + dxVal, ty: existingMatrix.ty + dyVal,
      };
    } else {
      // New matrix
      const newId = scFile.matrices.length;
      newMatrices = [...newMatrices, { id: newId, a: 1, b: 0, c: 0, d: 1, tx: dxVal, ty: dyVal }];
      newMatrixIndex = newId;
    }

    const newElements = frame.elements.map((e, i) =>
      i === selectedElem ? { ...e, matrixIndex: newMatrixIndex } : e
    );
    const newFrames = movieclip.frames.map((f, i) =>
      i === selectedFrame ? { ...f, elements: newElements } : f
    );
    const newMcs = scFile.movieclips.map(m =>
      m.id === movieclip.id ? { ...m, frames: newFrames } : m
    );
    setScFile({ ...scFile, matrices: newMatrices, movieclips: newMcs });
    Alert.alert('Applied', `Moved element by (${dxVal}, ${dyVal})`);
  }, [scFile, movieclip, frame, selectedFrame, selectedElem, dx, dy]);

  const cloneExport = useCallback(() => {
    if (!scFile || !exp || !movieclip) return;
    const newMcId  = Math.max(...scFile.movieclips.map(m => m.id)) + 1;
    const newExpId = Math.max(...scFile.exports.map(e => e.id)) + 1;
    const newMc    = { ...movieclip, id: newMcId };
    const newExp   = { ...exp, id: newExpId, name: exp.name + '_clone', movieclipId: newMcId };
    setScFile({
      ...scFile,
      exports:    [...scFile.exports, newExp],
      movieclips: [...scFile.movieclips, newMc],
    });
    Alert.alert('Cloned', `Created "${newExp.name}"`);
  }, [scFile, exp, movieclip]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.accentYellow} />
    </View>
  );

  if (!exp || !movieclip) return (
    <View style={styles.center}>
      <Ionicons name="warning-outline" size={48} color={Colors.accentRed} />
      <Text style={styles.errorText}>Export not found</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{
        title: exp.name,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={cloneExport} hitSlop={8}>
              <Ionicons name="copy-outline" size={22} color={Colors.accentBlue} />
            </TouchableOpacity>
          </View>
        ),
      }} />

      {/* Frame selector */}
      <View style={styles.frameBar}>
        <Text style={styles.frameLabel}>FRAMES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.frameList}>
          {movieclip.frames.map((f, i) => (
            <TouchableOpacity key={i}
              style={[styles.frameChip, selectedFrame === i && styles.frameChipActive]}
              onPress={() => { setSelectedFrame(i); setSelectedElem(-1); }}>
              <Text style={[styles.frameChipText, selectedFrame === i && styles.frameChipTextActive]}>
                {f.name || `#${i}`}
              </Text>
            </TouchableOpacity>
          ))}
          {movieclip.frames.length === 0 && (
            <Text style={styles.emptyFrames}>No frames</Text>
          )}
        </ScrollView>
      </View>

      {/* Elements list */}
      <FlatList
        style={styles.elemList}
        data={frame?.elements ?? []}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No elements in this frame</Text>
          </View>
        }
        renderItem={({ item: el, index: i }) => {
          const selected = i === selectedElem;
          const shape = scFile?.shapes.find(s => s.id === el.shapeId);
          return (
            <TouchableOpacity
              style={[styles.elemRow, selected && styles.elemRowActive]}
              onPress={() => setSelectedElem(selected ? -1 : i)}
              activeOpacity={0.75}>
              <Ionicons name="layers-outline" size={20}
                color={selected ? Colors.accentBlue : Colors.onDarkSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.elemTitle}>
                  Shape #{el.shapeId}  ({shape?.chunks.length ?? '?'} chunks)
                </Text>
                <Text style={styles.elemSub}>
                  Matrix: {el.matrixIndex}  ·  ColorSpace: {el.colorSpaceIndex}
                </Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={18} color={Colors.accentBlue} />}
            </TouchableOpacity>
          );
        }}
      />

      {/* Position controls */}
      {selectedElem >= 0 && (
        <View style={styles.posPanel}>
          <Text style={styles.posLabel}>LIVE POSITION EDIT</Text>
          <View style={styles.posRow}>
            <View style={styles.posInput}>
              <Text style={styles.posInputLabel}>Δ X</Text>
              <TextInput style={styles.input} value={dx} onChangeText={setDx}
                keyboardType="numeric" placeholderTextColor={Colors.onDarkSecondary} />
            </View>
            <View style={styles.posInput}>
              <Text style={styles.posInputLabel}>Δ Y</Text>
              <TextInput style={styles.input} value={dy} onChangeText={setDy}
                keyboardType="numeric" placeholderTextColor={Colors.onDarkSecondary} />
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={applyMove}>
              <Ionicons name="checkmark" size={20} color={Colors.background} />
            </TouchableOpacity>
          </View>
          {/* D-pad */}
          <View style={styles.dpad}>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => { setDy('-5'); applyMove(); }}>
              <Ionicons name="chevron-up" size={22} color={Colors.accentBlue} />
            </TouchableOpacity>
            <View style={styles.dpadRow}>
              <TouchableOpacity style={styles.dpadBtn} onPress={() => { setDx('-5'); applyMove(); }}>
                <Ionicons name="chevron-back" size={22} color={Colors.accentBlue} />
              </TouchableOpacity>
              <View style={styles.dpadCenter} />
              <TouchableOpacity style={styles.dpadBtn} onPress={() => { setDx('5'); applyMove(); }}>
                <Ionicons name="chevron-forward" size={22} color={Colors.accentBlue} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => { setDy('5'); applyMove(); }}>
              <Ionicons name="chevron-down" size={22} color={Colors.accentBlue} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: Colors.background },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText:        { color: Colors.accentRed, fontSize: 16, fontWeight: '700' },
  backBtn:          { backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText:      { color: Colors.onDark, fontWeight: '600' },
  frameBar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
                      paddingVertical: 8, paddingHorizontal: 12, gap: 10 },
  frameLabel:       { color: Colors.onDarkSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  frameList:        { gap: 6, alignItems: 'center' },
  frameChip:        { backgroundColor: Colors.card, borderRadius: 8,
                      paddingHorizontal: 12, paddingVertical: 6 },
  frameChipActive:  { backgroundColor: Colors.accentYellow },
  frameChipText:    { color: Colors.onDark, fontSize: 12 },
  frameChipTextActive: { color: Colors.background, fontWeight: '700' },
  emptyFrames:      { color: Colors.onDarkSecondary, fontSize: 12 },
  elemList:         { flex: 1 },
  elemRow:          { flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
                      borderWidth: 1, borderColor: Colors.border },
  elemRowActive:    { borderColor: Colors.accentBlue, backgroundColor: Colors.card },
  elemTitle:        { color: Colors.onDark, fontSize: 13, fontWeight: '600' },
  elemSub:          { color: Colors.onDarkSecondary, fontSize: 11, marginTop: 2 },
  emptyText:        { color: Colors.onDarkSecondary },
  posPanel:         { backgroundColor: Colors.surface, padding: 14, gap: 10,
                      borderTopWidth: 1, borderTopColor: Colors.border },
  posLabel:         { color: Colors.onDarkSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  posRow:           { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  posInput:         { flex: 1 },
  posInputLabel:    { color: Colors.onDarkSecondary, fontSize: 11, marginBottom: 4 },
  input:            { backgroundColor: Colors.card, color: Colors.onDark, borderRadius: 8,
                      paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
                      borderWidth: 1, borderColor: Colors.border },
  applyBtn:         { backgroundColor: Colors.accentYellow, borderRadius: 8,
                      padding: 10, alignItems: 'center', justifyContent: 'center' },
  dpad:             { alignItems: 'center', gap: 2 },
  dpadRow:          { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dpadBtn:          { backgroundColor: Colors.card, borderRadius: 8, padding: 8 },
  dpadCenter:       { width: 40, height: 40 },
});

// Note: PreviewScreen is at /preview — navigate with exportId param
