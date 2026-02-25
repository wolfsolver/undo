/**
 * Simple Plugin
 *
 * @format
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Pressable,
} from 'react-native';
import { PluginManager } from 'sn-plugin-lib';
import { SettingProvider } from './utils/SettingContext';
import Setting from './module/Setting';
import Main from './module/Main';
import { useSettings } from './utils/SettingContext';
import { log } from './utils/ConsoleLog';
import config from './app.json';

/**
 * Plugin View
 * Displays Hello World text in the center of the screen
 */
function AppContent(): React.JSX.Element {
  const { settings, updateSettings, isLoading } = useSettings();
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');
  const pendingEvents = useRef<any[]>([]);
  const isLoadingRef = useRef(isLoading);
  const updateSettingsRef = useRef(updateSettings);
  const [mainKey, setMainKey] = useState(0);

  // Keep refs up to date to avoid stale closures in the event listener
  useEffect(() => {
    isLoadingRef.current = isLoading;
    updateSettingsRef.current = updateSettings;
  }, [isLoading, updateSettings]);

  const processButtonPress = (event: any) => {
    log('App', 'Processing Button Press: ' + JSON.stringify(event));
    if (event.id === 100) {
      setMainKey(prev => prev + 1);
      setCurrentView('main');
    }
  };

  useEffect(() => {
    // Process any buffered events when loading finishes
    if (!isLoading && pendingEvents.current.length > 0) {
      log('App', `Processing ${pendingEvents.current.length} buffered events`);
      pendingEvents.current.forEach((event) => {
        processButtonPress(event);
      });
      pendingEvents.current = [];
    }
  }, [isLoading]);

  useEffect(() => {
    // Listen for the Config (Gear) button click
    const configSub = PluginManager.registerConfigButtonListener({
      onClick: () => {
        setCurrentView('settings');
      },
    });

    // Listen for custom toolbar buttons (like our Home button ID: 100)
    const buttonSub = PluginManager.registerButtonListener({
      onButtonPress: (event) => {
        log('App', 'Button Pressed: ' + JSON.stringify(event));
        if (isLoadingRef.current) {
          log('App', 'Settings still loading, buffering event');
          pendingEvents.current.push(event);
        } else {
          processButtonPress(event);
        }
      },
    });

    return () => {
      configSub.remove();
      buttonSub.remove();
    };
  }, []);

  const handleClose = () => {
    setCurrentView('main');
    PluginManager.closePluginView();
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loader}>
          <View style={styles.header}>
            <Text style={styles.title}>[{config.name}] Loading...</Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={[styles.closeText, { color: '#000000' }]}>✕</Text>
            </Pressable>
            <StatusBar
              barStyle={'dark-content'}
              backgroundColor={'#ffffff'}
            />
          </View>
          <Text style={styles.loadingText}>Loading Settings...</Text>
        </View>
      ) : (
        currentView === 'main' ? (
          <Main key={mainKey} onClose={handleClose} />
        ) : (
          <Setting onClose={handleClose} />
        )
      )}
    </View>
  );
}

function App(): React.JSX.Element {
  return (
    <SettingProvider>
      <AppContent />
    </SettingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#000',
  },
  loader: { flex: 1 },
  loadingText: { textAlign: 'center', marginTop: 20 },
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
  helloText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default App;
