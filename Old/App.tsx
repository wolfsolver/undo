import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { PluginCommAPI, PluginManager, PluginFileAPI } from 'sn-plugin-lib';
import { log } from './components/ConsoleLog';
import { loadSettings } from './components/Storage';

import { PointUtils, type Point } from 'sn-plugin-lib';

let pageSize = { width: 1404, height: 1872 };

async function emrPoint2Android(point: Point) {
    return PointUtils.emrPoint2Android(point, pageSize);
}

const DEFAULT_SETTINGS = {
    scribbleWhenPenUp: false,
    scribbleToDelete: true,
    scribbleToRectangle: true,
    scribbleToCircle: true,
    scribbleToTriangle: true,
    scribbleToEllipse: true,
    scribbleToArrow: true,
};

/**
 * SmartPenToolkit - App.tsx
 * Automatically detects and converts hand-drawn shapes (Square, Rectangle, Triangle, Circle, Ellipse)
 * into high-quality geometry objects on startup.
 */
export default function App() {
    const [status, setStatus] = useState('Initializing...');
    const [isProcessing, setIsProcessing] = useState(false);
    const [stats, setStats] = useState({ total: 0, converted: 0 });

    const savedSettings = loadSettings();
    const settings = savedSettings ? { ...DEFAULT_SETTINGS, ...savedSettings } : DEFAULT_SETTINGS;

    setStatus("Initializing...");
    const handleClose = () => {
        PluginManager.closePluginView();
    };

    useEffect(() => {
        const processElementsOnStartup = async () => {
            setIsProcessing(true);
            try {
                // 1. Get current file path and page number
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
                log('App', `Analyzing ${elements.length} elements...`);

                // 3. Process each element to detect shapes
                for (let i = 0; i < elements.length; i++) {
                    const el = elements[i];

                    // Only process strokes (Type 0)
                    if (el.type === 0 && el.stroke) {
                        const shape = await detectShape(el);
                        if (shape) {
                            setStatus(`Converting element ${i + 1}/${elements.length} (${shape.type})...`);
                            log('App', `Converting element ${i + 1}/${elements.length} (${shape.type})...`);

                            const insertRes = await insertShapeGeometry(shape);

                            if (insertRes?.success) {
                                log('App', `Element ${i + 1}/${elements.length} (${shape.type}) converted successfully.`);
                                // Delete the original hand-drawn stroke
                                // TODO: Replace with new api when ready: await PluginCommAPI.recycleElement(el.uuid);
                                convertedCount++;
                                setStats(s => ({ ...s, converted: convertedCount }));
                            } else {
                                log('App', `Element ${i + 1}/${elements.length} (${shape.type}) conversion failed.`);
                            }
                        }
                    }
                }

                setStatus(`Process complete! ${convertedCount} shapes converted.`);
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
    async function detectShape(el: any) {
        try {
            const pointsAccessor = el.stroke.points;
            const size = await pointsAccessor.size();

            // Too few points to be a meaningful shape
            if (size < 15) return null;

            const points = await pointsAccessor.getRange(0, size);

            let minX = points[0].x, maxX = points[0].x;
            let minY = points[0].y, maxY = points[0].y;

            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }

            const width = maxX - minX;
            const height = maxY - minY;

            // Ignore very small scribbles
            if (width < 30 || height < 30) return null;

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const avgRadius = (width + height) / 4;

            // 1. Check for circularity (variance of distances from centroid)
            let distVariance = 0;
            for (const p of points) {
                const d = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
                distVariance += Math.abs(d - avgRadius);
            }
            const circularityScore = distVariance / points.length / avgRadius;

            const aspectRatio = width / height;
            const isSquareLike = Math.abs(aspectRatio - 1) < 0.25;

            const bounds = { minX, minY, maxX, maxY, width, height, centerX, centerY };

            // Heuristic for Circle/Ellipse
            if (circularityScore < 0.20 && (settings.scribbleToCircle || settings.scribbleToEllipse)) {
                return { type: isSquareLike ? 'circle' : 'ellipse', bounds };
            }

            // 2. Check for Triangle/Rectangle/Square using filling ratio (Area check)
            let polygonArea = 0;
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                polygonArea += (p1.x * p2.y) - (p2.x * p1.y);
            }
            polygonArea = Math.abs(polygonArea) / 2;

            const boxArea = width * height;
            const fillingRatio = polygonArea / boxArea;

            // Heuristics for polygons
            if (fillingRatio > 0.75 && settings.scribbleToRectangle) {
                return { type: isSquareLike ? 'square' : 'rectangle', bounds };
            } else if (fillingRatio > 0.35 && fillingRatio < 0.65 && settings.scribbleToTriangle) {
                return { type: 'triangle', bounds };
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Inserts a clean geometry object based on detected shape
     */
    async function insertShapeGeometry(shape: any) {
        const { type, bounds } = shape;
        const { minX, minY, maxX, maxY, width, height, centerX, centerY } = bounds;

        const geometry: any = {
            penColor: 0x9D, // Dark gray
            penType: 10,   // Fineliner
            penWidth: 500,
            type: '',
            points: [],
            ellipseCenterPoint: null,
            ellipseMajorAxisRadius: 0,
            ellipseMinorAxisRadius: 0,
            ellipseAngle: 0,
        };

        if (type === 'circle' || type === 'ellipse') {
            geometry.type = type === 'circle' ? 'GEO_circle' : 'GEO_ellipse';
            geometry.ellipseCenterPoint = { x: centerX, y: centerY };
            geometry.ellipseMajorAxisRadius = width / 2;
            geometry.ellipseMinorAxisRadius = height / 2;
        } else if (type === 'square' || type === 'rectangle') {
            geometry.type = 'GEO_polygon';
            geometry.points = [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY },
                { x: minX, y: minY } // Close the path
            ];
        } else if (type === 'triangle') {
            geometry.type = 'GEO_polygon';
            geometry.points = [
                { x: centerX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY },
                { x: centerX, y: minY } // Close the path
            ];
        }

        log('App', `Inserting geometry EMR: ${JSON.stringify(geometry)}`);

        // switch point from EMR to Android
        geometry.points = await Promise.all(geometry.points.map(emrPoint2Android));

        log('App', `Inserting geometry Android: ${JSON.stringify(geometry)}`);
        return await PluginCommAPI.insertGeometry(geometry);
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>SmartPen Toolkit</Text>
                <Pressable style={styles.closeButton} onPress={handleClose}>
                    <Text style={styles.closeText}>✕</Text>
                </Pressable>
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
        backgroundColor: '#F5F5F5'
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
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000',
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#333',
    },
    scrollContent: {
        padding: 16,
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
