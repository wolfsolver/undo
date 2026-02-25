import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, TextInput, StatusBar, useColorScheme } from 'react-native';
import { log } from '../utils/ConsoleLog';
import { useSettings } from '../utils/SettingContext';
import config from '../app.json';
import SettingsToggle from '../utils/SettingsToggle';

interface SettingProps {
  onClose: () => void;
}

const Setting = ({ onClose }: SettingProps) => {
  log("Setting", "Opening");

  const { settings, updateSettings, isLoading, resetToDefault } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);

  // Update local settings if global settings change (e.g. after loading or reset)
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (isLoading) return <View style={styles.container}><Text>Loading...</Text></View>;

  const handleClose = async () => {
    log("Setting", "Exit without saving");
    onClose();
  };

  const handleSaveAndClose = async () => {
    log("Setting", "Saving and closing");
    await updateSettings(localSettings);
    onClose();
  };

  const handleRestore = async () => {
    log("Setting", "Restoring defaults");
    await resetToDefault();
    // settings will update, and useEffect will update localSettings
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>[{config.name}] Settings </Text>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Text style={[styles.closeText, { color: '#000000' }]}>✕</Text>
        </Pressable>
        <StatusBar
          barStyle={'dark-content'}
          backgroundColor={'#ffffff'}
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
          >
            <Text style={styles.restoreButtonText}>Restore Defaults</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleSaveAndClose}
          >
            <Text style={styles.exitButtonText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <SettingsToggle
            label="Analizze Scribble when pen up"
            value={localSettings.scribbleWhenPenUp}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleWhenPenUp: !prev.scribbleWhenPenUp }))}
          />
        </View>
        <View style={styles.row}>
          <SettingsToggle
            label="Recognize scribble to delete"
            value={localSettings.scribbleToDelete}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleToDelete: !prev.scribbleToDelete }))}
          />
        </View>
        <View style={styles.row}>
          <SettingsToggle
            label="Recognize scribble to rectangle"
            value={localSettings.scribbleToRectangle}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleToRectangle: !prev.scribbleToRectangle }))}
          />
        </View>
        <View style={styles.row}>
          <SettingsToggle
            label="Recognize scribble to circle"
            value={localSettings.scribbleToCircle}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleToCircle: !prev.scribbleToCircle }))}
          />
        </View>
        <View style={styles.row}>
          <SettingsToggle
            label="Recognize scribble to triangle"
            value={localSettings.scribbleToTriangle}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleToTriangle: !prev.scribbleToTriangle }))}
          />
        </View>
        <View style={styles.row}>
          <SettingsToggle
            label="Recognize scribble to ellipse"
            value={localSettings.scribbleToEllipse}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleToEllipse: !prev.scribbleToEllipse }))}
          />
        </View>
        <View style={styles.row}>
          <SettingsToggle
            label="Recognize scribble to arrow"
            value={localSettings.scribbleToArrow}
            onToggle={() => setLocalSettings(prev => ({ ...prev, scribbleToArrow: !prev.scribbleToArrow }))}
          />
        </View>


      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  toggleWrapper: { flexDirection: 'row', alignItems: 'center' },
  statusText: { marginRight: 10, fontWeight: 'bold', width: 30 },
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  section: { width: '100%', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', minWidth: 100, textAlign: 'right' },
  info: { marginTop: 10, fontStyle: 'italic' },
  exitButton: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 20, alignItems: 'center', borderRadius: 4 },
  exitButtonText: { color: '#FFF', fontWeight: 'bold' },
  restoreButton: { backgroundColor: '#eee', paddingVertical: 8, paddingHorizontal: 15, alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: '#ccc' },
  restoreButtonText: { color: '#000', fontWeight: '500' },
  switch: {
    width: 60,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  switchOn: {
    backgroundColor: '#000',
  },
  switchOff: {
    backgroundColor: '#333',
  },
  handle: {
    width: 22,
    height: 22,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  handleOn: {
    alignSelf: 'flex-end',
  },
  handleOff: {
    alignSelf: 'flex-start',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default Setting;