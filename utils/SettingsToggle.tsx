import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface SettingsToggleProps {
    label: string;
    value: boolean;
    onToggle: () => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ label, value, onToggle }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>

            <View style={styles.toggleWrapper}>
                <Text style={styles.statusText}>{value ? 'ON' : 'OFF'}</Text>

                <Pressable
                    style={[styles.switch, value ? styles.switchOn : styles.switchOff]}
                    onPress={onToggle}
                >
                    <View style={[
                        styles.handle,
                        value ? styles.handleOn : styles.handleOff
                    ]} />
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        width: '100%',
    },
    label: { fontSize: 16, color: '#000' },
    toggleWrapper: { flexDirection: 'row', alignItems: 'center' },
    statusText: { marginRight: 10, fontSize: 14, fontWeight: 'bold' },
    switch: {
        width: 50,
        height: 25,
        borderRadius: 15,
        padding: 2,
    },
    switchOn: { backgroundColor: '#000' }, // Supernote style (Black/White)
    switchOff: { backgroundColor: '#ccc' },
    handle: {
        width: 21,
        height: 21,
        borderRadius: 11,
        backgroundColor: '#fff',
    },
    handleOn: { alignSelf: 'flex-end' },
    handleOff: { alignSelf: 'flex-start' },
});

export default SettingsToggle;