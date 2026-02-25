import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Settings, DEFAULT_SETTINGS } from '../config/defaultSettings';
// Importing your existing storage functions
import { loadSettings, saveSettings } from './Storage';

/**
 * Interface for the Context value provided to the app
 */
interface SettingContextType {
    settings: Settings;
    updateSettings: (newFields: Partial<Settings>) => Promise<void>;
    isLoading: boolean;
    resetToDefault: () => Promise<void>;
}

const SettingContext = createContext<SettingContextType | undefined>(undefined);

/**
 * SettingProvider Component
 */
export const SettingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initializing with DEFAULT_SETTINGS ensures the app has data while loading
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Load data from settings.json on mount
    useEffect(() => {
        const initSettings = async () => {
            try {
                // Using your loadSettings() function from Storage.tsx
                const savedData = await loadSettings();

                if (savedData) {
                    /**
                     * DEEP MERGE STRATEGY:
                     * We merge DEFAULT_SETTINGS with the saved data. 
                     * This populates any missing fields if the app was updated with new settings.
                     */
                    setSettings({
                        ...DEFAULT_SETTINGS,
                        ...savedData
                    });
                } else {
                    // If the file doesn't exist, we create it with defaults using your saveSettings()
                    await saveSettings(DEFAULT_SETTINGS);
                }
            } catch (error) {
                console.error("[SettingContext]: Failed to load settings:", error);
                // Fallback: stay with DEFAULT_SETTINGS
            } finally {
                setIsLoading(false);
            }
        };

        initSettings();
    }, []);

    /**
     * Updates specific settings fields.
     * Merges the new fields into the current state and persists to disk.
     */
    const updateSettings = async (newFields: Partial<Settings>) => {
        setSettings(prev => {
            const updated = {
                ...prev,
                ...newFields
            };
            // Persist the updated settings
            saveSettings(updated).catch(error => {
                console.error("[SettingContext]: Failed to save settings:", error);
            });
            return updated;
        });
    };

    /**
     * Resets all application settings to their factory defaults
     */
    const resetToDefault = async () => {
        setSettings(DEFAULT_SETTINGS);
        await saveSettings(DEFAULT_SETTINGS);
    };

    return (
        <SettingContext.Provider value={{ settings, updateSettings, isLoading, resetToDefault }}>
            {children}
        </SettingContext.Provider>
    );
};

/**
 * Custom hook to consume settings in any functional component
 */
export const useSettings = () => {
    const context = useContext(SettingContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingProvider');
    }
    return context;
};