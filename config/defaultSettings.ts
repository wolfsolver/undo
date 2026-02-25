/**
 * config/defaultSettings.ts
 * This file defines the "Source of Truth" for the app settings.
 * Modify this object to add new features to the template.
 */

export interface Settings {
    scribbleWhenPenUp: boolean;
    scribbleToDelete: boolean;
    scribbleToRectangle: boolean;
    scribbleToCircle: boolean;
    scribbleToTriangle: boolean;
    scribbleToEllipse: boolean;
    scribbleToArrow: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
    scribbleWhenPenUp: false,
    scribbleToDelete: true,
    scribbleToRectangle: true,
    scribbleToCircle: true,
    scribbleToTriangle: true,
    scribbleToEllipse: true,
    scribbleToArrow: true,
};


