import { AppRegistry } from 'react-native';
import { PluginManager, PluginFileAPI, PluginCommAPI } from 'sn-plugin-lib';
import App from './App';
import { name as appName } from './app.json';
import { getDirPath, saveStringTo } from './components/Storage.ts';

AppRegistry.registerComponent(appName, () => App);
PluginManager.init();

const PADDING = 15;
const MARGIN = 100;

let lastProcessedUuid = null;

PluginManager.registerEventListener('event_pen_up', 1, {
  async onMsg(msg) {
    const elements = msg; // [cite: 5]
    if (!elements || elements.length === 0) return;
    const new_uuid = elements[0].uuid;
    if (new_uuid === lastProcessedUuid) {
      //		console.log("[UNDO-LOG] duble fired.. ignore.");
      return;
    }
    lastProcessedUuid = new_uuid;

    console.log(`[UNDO-LOG/1] Pen up. Analyzing ${elements.length} new elements...`);
    //    console.log(`[UNDO-LOG] elements = ${JSON.stringify(elements)}`);

    saveStringTo(JSON.stringify(elements), '/sdcard/elements.json');

    for (const el of elements) {
      console.log(`[UNDO-LOG/2] ${el.uuid} of type ${el.type}`);
      // Check if it's a stroke (TYPE_STROKE = 0) [cite: 5]
      if (el.type === 0 && el.stroke) {

        const isScribble = await analyzeScribble(el.stroke);

        if (!isScribble) {
          console.log(`[UNDO-LOG/3a] (UUID: ${el.uuid}) is not a Scribble`);
        } else {
          console.log(`[UNDO-LOG/3b] Scribble confirmed (UUID: ${el.uuid}). Searching for elements to delete...`);
          console.log(`[UNDO-LOG/3c] Getting path`);
          const pathRes = await PluginCommAPI.getCurrentFilePath();
          console.log(`[UNDO-LOG/3d] pathRes ${pathRes.result}. Getting elements`);
          const pageRes = await PluginFileAPI.getElements(el.pageNum, pathRes.result);
          // console.log(`[UNDO-LOG/4] element on page ${JSON.stringify(pageRes)}`);
          saveStringTo(JSON.stringify(pageRes), '/sdcard/pageRes.json');
          console.log(`[UNDO-LOG/4] element on page read`);

          if (!pageRes.success) {
            console.log('[UNDO-LOG/6a] pageRes result emptyu');
          } else {
            const scribbleArea = await getElementBounds(el);
            // saveStringTo(JSON.stringify(scribbleArea), '/sdcard/scribbleArea.json');
            console.log(`[UNDO-LOG/5] scribbleArea ${JSON.stringify(scribbleArea)}`);

            let removedCount = 0;
            console.log(`[UNDO-LOG/6b] element on page ${pageRes.result.length}`);
            for (const target of pageRes.result) {
              console.log('[UNDO-LOG/7] Element', target.uuid, 'found');
              if (target.uuid === el.uuid) {
                console.log('[UNDO-LOG/8] Element', target.uuid, 'is scrible');
                continue;
              }
              // We need to verify the bounds.
              // target has its own contours (contoursSrc) which are arrays of arrays of points
              // from which we derive the bounding box.
              const targetArea = await getElementBounds(target);

              // Bounding Box collision check [cite: 5]
              if (checkOverlap(scribbleArea, targetArea)) {
                console.log('[UNDO-LOG/9] Element', target.uuid, 'will be removed');

                // Release native cache and remove the element 
                delete_element(target.uuid); // 
                removedCount++;
              }
            }

            // Remove the scribble itself to leave no trace 
            delete_element(el.uuid);

            // add new element just for testing. 
            insertGeometryFromArea(scribbleArea);
            insertLineFromArea(scribbleArea);

            console.log(`[UNDO-LOG/A] Success: Removed ${removedCount} elements and cleaned up the scribble.`);
          }
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

  console.log(`[UNDO-LOG/analyzeScribble] Analyzing ${size} pointsAccessor`);

  // A significant scribble has many points
  if (size < 30) return false;

  const points = await pointsAccessor.getRange(0, size);

  console.log(`[UNDO-LOG/analyzeScribble] Analyzing ${points.length} points`);
  // saveStringTo(JSON.stringify(points), '/sdcard/points1.json');

  let xInversions = 0;
  let yInversions = 0;
  let totalDistance = 0;

  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;

  // use for for performance and memory protection
  // start from 1 to avoid double counting
  for (let i = 1; i < points.length; i++) {
    const curr = points[i];

    // Bounding Box update
    if (curr.x < minX) minX = curr.x;
    if (curr.x > maxX) maxX = curr.x;
    if (curr.y < minY) minY = curr.y;
    if (curr.y > maxY) maxY = curr.y;

    const prev = points[i - 1];
    // Calculate distance traveled
    totalDistance += Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));

    if (i >= 2) {
      const prev = points[i - 1];
      const pPrev = points[i - 2];
      // X-axis inversions
      if (Math.sign(curr.x - prev.x) !== Math.sign(prev.x - pPrev.x) && Math.abs(curr.x - prev.x) > 2) {
        xInversions++;
      }
      // Y-axis inversions
      if (Math.sign(curr.y - prev.y) !== Math.sign(prev.y - pPrev.y) && Math.abs(curr.y - prev.y) > 2) {
        yInversions++;
      }
    }
  }

  // Bounding Box size calculation
  const width = maxX - minX;
  const height = maxY - minY;
  const areaDiagonal = Math.sqrt(width * width + height * height);

  // IDENTIFICATION LOGIC:
  // 1. Many total inversions
  // 2. The total distance traveled is much larger than the diagonal of the occupied area
  const isDense = totalDistance > areaDiagonal * 3;
  const hasEnoughJiggles = (xInversions + yInversions) > 10;

  console.log(`[UNDO-LOG/analyzeScribble] Analysis: Inversions(X:${xInversions}, Y:${yInversions}), Density:${(totalDistance / areaDiagonal).toFixed(2)}`);

  return isDense && hasEnoughJiggles;
}

async function getElementBounds(el) {
  const size = await el.stroke.points.size(); // [cite: 3, 4]
  const points = await el.stroke.points.getRange(0, size); // [cite: 3, 4]
  //  saveStringTo(JSON.stringify(points), '/sdcard/points2.json');

  // Use for-loop for performance and memory protection
  let minX = points[0].x, minY = points[0].y;
  let maxX = points[0].x, maxY = points[0].y;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    minX: minX,
    minY: minY,
    maxX: maxX,
    maxY: maxY
  };
}

function checkOverlap(scribble, target) {
  // Quick comparison between bounding boxes [cite: 5]
  //  console.log(`[UNDO-LOG/checkOverlap] scribble ${JSON.stringify(scribble)}`);
  //  console.log(`[UNDO-LOG/checkOverlap] target ${JSON.stringify(target)}`);
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
    penWidth: 2,
    type: 'GEO_polygon',
    points: [
      { x: area.minX, y: area.minY }, // Top-left
      { x: area.maxX, y: area.minY }, // Top-right
      { x: area.maxX, y: area.maxY }, // Bottom-right
      { x: area.minX, y: area.maxY }, // Bottom-left
      { x: area.minX, y: area.minY }  // Back to start to close path 
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

async function insertLineFromArea(area) {
  const geometry = {
    penColor: 0x9D,
    penType: 10,
    penWidth: 2,
    type: 'straightLine',
    points: [
      { x: area.minX, y: area.minY + 10 }, // Top-left
      { x: area.maxX, y: area.minY + 10 }, // Top-right
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