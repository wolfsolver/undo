import React, { useState, useEffect } from 'react';
import { PluginCommAPI, PluginManager, PluginFileAPI, PointUtils, type Point, Geometry } from 'sn-plugin-lib';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, TextInput, StatusBar, useColorScheme, ScrollView, ActivityIndicator } from 'react-native';
import { log } from '../utils/ConsoleLog';
import { useSettings } from '../utils/SettingContext';
import config from '../app.json';
import SettingsToggle from '../utils/SettingsToggle';

interface SettingProps {
    onClose: () => void;
}

let pageSize = { width: 1404, height: 1872 };

async function emrPoint2Android(point: Point) {
    return PointUtils.emrPoint2Android(point, pageSize);
}

const Main = ({ onClose }: SettingProps) => {
    log("Box", "Opening");
    const isDarkMode = useColorScheme() === 'dark';
    const { settings, updateSettings, isLoading } = useSettings();

    const [status, setStatus] = useState('Initializing...');
    const [isProcessing, setIsProcessing] = useState(false);
    const [stats, setStats] = useState({ total: 0, converted: 0 });

    const handleClose = async () => {
        log("Box", "Exit");
        onClose();
    };

    useEffect(() => {
        const processElementsOnStartup = async () => {
            log("Box", "Processing elements on startup");
            setIsProcessing(true);
            try {
                // 1. Get current file path and page number
                log("Box", "Locating current page...");
                setStatus('Locating current page...');
                const pathRes = await PluginCommAPI.getCurrentFilePath() as any;
                const pageRes = await PluginCommAPI.getCurrentPageNum() as any;

                if (!pathRes?.success || !pageRes?.success) {
                    setStatus('Error: Could not identify current file or page.');
                    setIsProcessing(false);
                    return;
                }

                const filePath = pathRes.result;
                const pageNum = pageRes.result;

                const sizeRes = await PluginFileAPI.getPageSize(filePath, pageNum) as any;
                if (sizeRes?.success && sizeRes.result) {
                    pageSize = sizeRes.result;
                }

                const emrPageSize = {
                    width: PointUtils.getRealMaxX(pageSize),
                    height: PointUtils.getRealMaxY(pageSize)
                };
                log("Box", `Dimensioni Android: ${pageSize.width}x${pageSize.height}`);
                log("Box", `Dimensioni EMR rilevate: ${emrPageSize.width}x${emrPageSize.height}`);

                log("Box", "Reading elements on page " + pageNum);
                // 2. Read elements from the current page
                setStatus(`Reading elements on page ${pageNum}...`);
                const elementsRes = await PluginFileAPI.getElements(pageNum, filePath) as any;

                if (!elementsRes?.success || !elementsRes.result) {
                    setStatus('Error: Could not read page elements.');
                    setIsProcessing(false);
                    return;
                }

                const elements = elementsRes.result;
                let convertedCount = 0;
                setStats({ total: elements.length, converted: 0 });

                setStatus(`Analyzing ${elements.length} elements...`);
                log('Box', `Analyzing ${elements.length} elements...`);

                // 3. Process each element to detect Box
                for (let i = 0; i < elements.length; i++) {
                    const el = elements[i];

                    // Only process strokes (Type 0)
                    if (el.type === 0 && el.stroke) {
                        // determine box and design
                        detectBox(el)
                        convertedCount++;
                        setStats(s => ({ ...s, converted: convertedCount }));
                    }
                }

                setStatus(`Process complete! ${convertedCount} shapes converted.`);
                handleClose();
            } catch (error) {
                log('App', `Processing error: ${error}`);
                setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setIsProcessing(false);
            }
        };

        processElementsOnStartup();
    }, []);

    /**
     * Simple heuristic-based shape detection
     */
    async function detectBox(el: any) {
        log("Box", "Detecting shape for element " + el.uuid);
        try {
            const pointsAccessor = el.stroke.points;
            const size = await pointsAccessor.size();

            // Too few points to be a meaningful shape
            if (size < 15) return null;

            let points = await pointsAccessor.getRange(0, size);

            let minX = points[0].x, maxX = points[0].x;
            let minY = points[0].y, maxY = points[0].y;

            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }

            const geometry: any = {
                penColor: 0x9D, // Dark gray
                penType: 10,   // Fineliner
                penWidth: 500,
                type: 'GEO_polygon',
                points: [
                    { x: minX, y: minY }, { x: maxX, y: minY },
                    { x: maxX, y: maxY }, { x: minX, y: maxY },
                    { x: minX, y: minY }
                ],
                ellipseCenterPoint: null,
                ellipseMajorAxisRadius: 0,
                ellipseMinorAxisRadius: 0,
                ellipseAngle: 0,
            };

            log('Box', `Inserting geometry EMR: ${JSON.stringify(geometry)}`);
            geometry.points = await Promise.all(geometry.points.map(emrPoint2Android));
            log('Box', `Inserting geometry Android: ${JSON.stringify(geometry)}`);

            await PluginCommAPI.insertGeometry(geometry);

            return null;
        } catch (e) {
            return null;
        }
    }


    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>[{config.name}] BOX Processing</Text>
                <Pressable style={styles.closeButton} onPress={handleClose}>
                    <Text style={[styles.closeText, { color: '#000000' }]}>✕</Text>
                </Pressable>
                <StatusBar
                    barStyle={'dark-content'}
                    backgroundColor={'#ffffff'}
                />
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <Text style={styles.statusTitle}>Shape Processing</Text>
                    <Text style={styles.statusText}>{status}</Text>

                    {isProcessing && (
                        <ActivityIndicator size="large" color="#000000" style={styles.loader} />
                    )}

                    {!isProcessing && stats.total > 0 && (
                        <View style={styles.statsContainer}>
                            <Text style={styles.statsLabel}>Total Elements: {stats.total}</Text>
                            <Text style={styles.statsLabel}>Shapes Converted: {stats.converted}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>Instructions</Text>
                    <Text style={styles.infoText}>
                        This toolkit automatically scans your current note page for hand-drawn shapes
                        and converts them into perfect geometric figures.
                    </Text>
                    <Text style={styles.infoText}>Supported shapes: Squares, Rectangles, Triangles, Circles, and Ellipses.</Text>
                </View>
            </ScrollView>
        </View>
    );

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContent: {
        padding: 16,
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
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    statusText: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
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
    loader: {
        marginTop: 20,
    },
    statsContainer: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    statsLabel: {
        fontSize: 14,
        color: '#444',
        marginBottom: 4,
    },
    infoBox: {
        backgroundColor: '#E3F2FD',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderLeftWidth: 6,
        borderColor: '#2196F3',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1976D2',
        marginBottom: 6,
    },
    infoText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
        marginBottom: 8,
    }
});

export default Main;