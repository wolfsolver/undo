import { AppRegistry, Image, DeviceEventEmitter } from 'react-native';
import { PluginManager, PluginFileAPI, PluginCommAPI } from 'sn-plugin-lib';
import Navigator from './Navigator';
import { name as appName } from './app.json';
import { getDirPath, saveStringTo, loadSettings } from './components/Storage.ts';
import { log } from './components/ConsoleLog.ts';

AppRegistry.registerComponent(appName, () => Navigator);
PluginManager.init();

PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: 'SmartPenToolkit',
  icon: Image.resolveAssetSource(require('./assets/smartpentoolkit.jpg')).uri,
  showType: 1,
});

PluginManager.registerButtonListener({
  onButtonPress(event) {
    log("index", "button press event received");
    pendingOpenSettings = true; // perche???
    DeviceEventEmitter.emit('openApp');
  },
});


PluginManager.registerConfigButton();
PluginManager.registerConfigButtonListener({
  onClick() {
    log("index", "config button press event received");
    pendingOpenSettings = true;
    DeviceEventEmitter.emit('openSettings');
  },
});

let pendingOpenSettings = false;

export const checkPendingSettings = () => {
  const value = pendingOpenSettings;
  pendingOpenSettings = false;
  log("index", `pendingOpenSettings: ${value}`);
  return value;
};


const MARGIN = 100;

const DEFAULT_SETTINGS = {
  scribbleWhenPenUp: false,
  scribbleToDelete: true,
  scribbleToRectangle: true,
  scribbleToCircle: true,
  scribbleToTriangle: true,
  scribbleToEllipse: true,
  scribbleToArrow: true,
};

let lastProcessedUuid = null;


PluginManager.registerEventListener('event_pen_up', 1, {
  async onMsg(msg) {
    log("index", "pen up event received");
    // Load settings to check which features are enabled
    const savedSettings = await loadSettings();
    const settings = savedSettings ? { ...DEFAULT_SETTINGS, ...savedSettings } : DEFAULT_SETTINGS;
    if (!settings.scribbleWhenPenUp) {
      log("index", "scribbleWhenPenUp is false");
      return;
    }
    log("index", "scribbleWhenPenUp is true");

    const elements = msg;
    if (!elements || elements.length === 0) return;
    const new_uuid = elements[0].uuid;
    if (new_uuid === lastProcessedUuid) {
      return;
    }
    lastProcessedUuid = new_uuid;

    console.log(`[UNDO-LOG/0] Settings: ${JSON.stringify(settings)}`);
    console.log(`[UNDO-LOG/1] Pen up. Analyzing ${elements.length} new elements...`);

    for (const el of elements) {
      if (el.type === 0 && el.stroke) {

        if (settings.scribbleToDelete) {
          console.log('[UNDO-LOG/Delete] Feature enabled. Analyzing scribble...');

          const isScribble = await analyzeScribble(el.stroke);

          if (isScribble) {
            console.log(`[UNDO-LOG/3b] Scribble confirmed (UUID: ${el.uuid})`);

            if (settings.scribbleToDelete) {
              console.log(`[UNDO-LOG/Delete] Feature enabled. Searching for elements to delete...`);
              const pathRes = await PluginCommAPI.getCurrentFilePath();
              // Fix for pathRes possible null/undefined
              if (pathRes && pathRes.success && pathRes.result) {
                const pageRes = await PluginFileAPI.getElements(el.pageNum, pathRes.result);
                if (pageRes && pageRes.success && pageRes.result) {
                  const scribbleArea = await getElementBounds(el);
                  let removedCount = 0;
                  for (const target of pageRes.result) {
                    if (target.uuid === el.uuid) continue;
                    const targetArea = await getElementBounds(target);
                    if (checkOverlap(scribbleArea, targetArea)) {
                      delete_element(target.uuid);
                      removedCount++;
                    }
                  }
                  // Remove the scribble itself 
                  delete_element(el.uuid);
                  console.log(`[UNDO-LOG/Delete] Removed ${removedCount} elements.`);
                }
              } else {
                console.error('[UNDO-LOG/Delete] Failed to get current file path or path is empty');
              }
            }
          }
        }
        if (settings.scribbleToSquare) {
          console.log('[UNDO-LOG/Square] Feature enabled. (NOT YET IMPLEMENTED)');
          // test
          insertGeometryFromArea(400, 400, 800, 700);

        }
        if (settings.scribbleToCircle) {
          console.log('[UNDO-LOG/Circle] Feature enabled. (NOT YET IMPLEMENTED)');
        }
        if (settings.scribbleToTriangle) {
          console.log('[UNDO-LOG/Triangle] Feature enabled. (NOT YET IMPLEMENTED)');
        }
        if (settings.scribbleToEllipse) {
          console.log('[UNDO-LOG/Ellipse] Feature enabled. (NOT YET IMPLEMENTED)');
        }
        if (settings.scribbleToArrow) {
          console.log('[UNDO-LOG/Arrow] Feature enabled. (NOT YET IMPLEMENTED)');
        }
      }
    }
    console.log(`[UNDO-LOG/Z] Pen up. End of analysis ${new_uuid}`);
  },
});

async function delete_element(uuid) {
  const res = await PluginCommAPI.recycleElement(uuid);
  if (!res.success) {
    throw new Error(res.error?.message ?? 'delete_element call failed');
  }
  console.log(`[UNDO-LOG/delete_element] Element ${uuid} deleted`);
  return res.result;
}

async function analyzeScribble(stroke) {
  const pointsAccessor = stroke.points;
  const size = await pointsAccessor.size();

  if (size < 30) return false;

  const points = await pointsAccessor.getRange(0, size);

  let xInversions = 0;
  let yInversions = 0;
  let totalDistance = 0;

  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];

    if (curr.x < minX) minX = curr.x;
    if (curr.x > maxX) maxX = curr.x;
    if (curr.y < minY) minY = curr.y;
    if (curr.y > maxY) maxY = curr.y;

    const prev = points[i - 1];
    totalDistance += Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));

    if (i >= 2) {
      const prev = points[i - 1];
      const pPrev = points[i - 2];
      if (Math.sign(curr.x - prev.x) !== Math.sign(prev.x - pPrev.x) && Math.abs(curr.x - prev.x) > 2) {
        xInversions++;
      }
      if (Math.sign(curr.y - prev.y) !== Math.sign(prev.y - pPrev.y) && Math.abs(curr.y - prev.y) > 2) {
        yInversions++;
      }
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const areaDiagonal = Math.sqrt(width * width + height * height);

  const isDense = totalDistance > areaDiagonal * 3;
  const hasEnoughJiggles = (xInversions + yInversions) > 10;

  return isDense && hasEnoughJiggles;
}

async function getElementBounds(el) {
  const size = await el.stroke.points.size();
  const points = await el.stroke.points.getRange(0, size);

  let minX = points[0].x, minY = points[0].y;
  let maxX = points[0].x, maxY = points[0].y;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return { minX, minY, maxX, maxY };
}

function checkOverlap(scribble, target) {
  return (
    target.minX >= (scribble.minX - MARGIN) &&
    target.maxX <= (scribble.maxX + MARGIN) &&
    target.minY >= (scribble.minY - MARGIN) &&
    target.maxY <= (scribble.maxY + MARGIN)
  );
}

async function insertGeometryFromArea(area) {
  const geometry = {
    penColor: 0x9D,
    penType: 10,
    penWidth: 500,
    type: 'GEO_polygon',
    points: [
      { x: area.minX, y: area.minY },
      { x: area.maxX, y: area.minY },
      { x: area.maxX, y: area.maxY },
      { x: area.minX, y: area.maxY },
      { x: area.minX, y: area.minY }
    ],
    ellipseCenterPoint: null,
    ellipseMajorAxisRadius: 0,
    ellipseMinorAxisRadius: 0,
    ellipseAngle: 0,
  };

  const res = await PluginCommAPI.insertGeometry(geometry);
  if (!res.success) {
    throw new Error(res.error?.message ?? 'insertGeometry call failed');
  }
  return res.result;
}

