/**
 * Simple Plugin
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Pressable,
    ScrollView,
} from 'react-native';
import { PluginManager } from 'sn-plugin-lib';
import { loadSettings, saveSettings } from './components/Storage';
import { log } from './components/ConsoleLog';

interface Settings {
    scribbleWhenPenUp: boolean;
    scribbleToDelete: boolean;
    scribbleToRectangle: boolean;
    scribbleToCircle: boolean;
    scribbleToTriangle: boolean;
    scribbleToEllipse: boolean;
    scribbleToArrow: boolean;
}

const DEFAULT_SETTINGS: Settings = {
    scribbleWhenPenUp: false,
    scribbleToDelete: true,
    scribbleToRectangle: true,
    scribbleToCircle: true,
    scribbleToTriangle: true,
    scribbleToEllipse: true,
    scribbleToArrow: true,
};

function Setting(): React.JSX.Element {
    log("setting", "started");

    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const initSettings = async () => {
            const saved = await loadSettings();
            if (saved) {
                setSettings({ ...DEFAULT_SETTINGS, ...saved });
            }
        };
        initSettings();

    }, []);

    const handleClose = () => {
        PluginManager.closePluginView();
    };

    const toggleSwitch = async (key: keyof Settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        await saveSettings(newSettings);
    };

    const renderFeatureToggle = (label: string, key: keyof Settings) => (
        <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{label}</Text>

            <View style={styles.toggleWrapper}>
                <Text style={styles.statusText}>{settings[key] ? 'ON' : 'OFF'}</Text>

                <Pressable
                    style={[styles.switch, settings[key] ? styles.switchOn : styles.switchOff]}
                    onPress={() => toggleSwitch(key)}
                >
                    <View style={[
                        styles.handle,
                        settings[key] ? styles.handleOn : styles.handleOff
                    ]} />
                </Pressable>
            </View>
        </View>
    );

    return (
        <View style={[styles.container]}>

            <View style={[styles.header]}>
                <Text style={[styles.headerTitle]}>
                    Plugin Settings
                </Text>
                <Pressable style={styles.closeButton} onPress={handleClose}>
                    <Text style={[styles.closeText]}>✕</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {renderFeatureToggle('Scribble when PenUp', 'scribbleWhenPenUp')}
                {renderFeatureToggle('Scribble to Delete', 'scribbleToDelete')}
                {renderFeatureToggle('Scribble to Square', 'scribbleToRectangle')}
                {renderFeatureToggle('Scribble to Circle', 'scribbleToCircle')}
                {renderFeatureToggle('Scribble to Triangle', 'scribbleToTriangle')}
                {renderFeatureToggle('Scribble to Ellipse', 'scribbleToEllipse')}
                {renderFeatureToggle('Scribble to Arrow', 'scribbleToArrow')}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 22,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 20,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
    },
    settingLabel: {
        fontSize: 18,
    },

    toggleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        marginRight: 10,
        fontWeight: 'bold',
        fontSize: 16,
        color: '#000',
    },
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
        // In alternativa puoi usare: transform: [{ translateX: 0 }] 
        // se gestisci il posizionamento con flex
    },
    handleOff: {
        alignSelf: 'flex-start',
    },

});

export default Setting;
