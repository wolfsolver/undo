import { AppRegistry } from 'react-native';
import { PluginManager, PluginFileAPI, PluginCommAPI } from 'sn-plugin-lib';
import App from './App';
import { name as appName } from './app.json';
import { getDirPath, saveStringTo } from './components/Storage.ts';

AppRegistry.registerComponent(appName, () => App);
PluginManager.init();

const PADDING = 15;

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

    console.log(`[UNDO-LOG/1] Penna alzata. Analisi di ${elements.length} nuovi elementi...`);
    //    console.log(`[UNDO-LOG] elements = ${JSON.stringify(elements)}`);

    saveStringTo(JSON.stringify(elements), '/sdcard/elements.json');

    for (const el of elements) {
      console.log(`[UNDO-LOG/2] ${el.uuid} di tipo ${el.type}`);
      // Verifichiamo se è uno stroke (TYPE_STROKE = 0) [cite: 5]
      if (el.type === 0 && el.stroke) {

        const isScribble = await analyzeScribble(el.stroke);

        if (!isScribble) {
          console.log(`[UNDO-LOG/3a] (UUID: ${el.uuid}) non e' uno Scarabocchio`);
        } else {
          console.log(`[UNDO-LOG/3b] Scarabocchio confermato (UUID: ${el.uuid}). Ricerca elementi da cancellare...`);
          console.log(`[UNDO-LOG/3c] Getting path`);
          const pathRes = await PluginCommAPI.getCurrentFilePath();
          console.log(`[UNDO-LOG/3d] pathRes ${pathRes.result}. Getting elements`);
          const pageRes = await PluginFileAPI.getElements(el.pageNum, pathRes.result);
          // console.log(`[UNDO-LOG/4] element on page ${JSON.stringify(pageRes)}`);
          saveStringTo(JSON.stringify(pageRes), '/sdcard/pageRes.json');
          console.log(`[UNDO-LOG/4] element on page readed`);

          const scribbleArea = await getElementBounds(el);
          saveStringTo(JSON.stringify(scribbleArea), '/sdcard/scribbleArea.json');
          console.log(`[UNDO-LOG/5] scribbleArea saved`);

          if (!pageRes.success) {
            console.log('[UNDO-LOG/6a] nothing to delete.');
          } else {
            let removedCount = 0;
            console.log(`[UNDO-LOG/6b] element behind scrible ${JSON.stringify(pageRes.result.length)}`);
            for (const target of pageRes.result) {
              console.log('[UNDO-LOG/7] Element', target.uuid, 'found');
              if (target.uuid === el.uuid) {
                console.log('[UNDO-LOG/8] Element', target.uuid, 'is scrible');
                continue;
              }
              // Controllo collisione Bounding Box [cite: 5]
              if (checkOverlap(scribbleArea, target)) {
                console.log('[UNDO-LOG/9] Element', target.uuid, 'will be removed');

                // Rilascia la cache nativa e rimuove l'elemento 
                // PluginCommAPI.recycleElement(target.uuid); // 
                removedCount++;
              }
            }

            // Rimuoviamo lo scarabocchio stesso per non lasciare tracce 
            // PluginCommAPI.recycleElement(el.uuid); // 
            console.log(`[UNDO-LOG/A] Successo: Rimossi ${removedCount} elementi e pulito lo scarabocchio.`);
          }
        }
      }
    }
    console.log(`[UNDO-LOG/Z] Penna alzata. Fine analisi ${new_uuid}`);
  },
});


async function analyzeScribble(stroke) {
  const pointsAccessor = stroke.points;
  const size = await pointsAccessor.size();

  console.log(`[UNDO-LOG/analyzeScribble] Analisi di ${size} pointsAccessor`);


  // Uno scarabocchio significativo ha molti punti
  if (size < 30) return false;

  const points = await pointsAccessor.getRange(0, size);

  console.log(`[UNDO-LOG/analyzeScribble] Analisi di ${points.length} punti`);
  saveStringTo(JSON.stringify(points), '/sdcard/points1.json');

  let xInversions = 0;
  let yInversions = 0;
  let totalDistance = 0;

  for (let i = 2; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const pPrev = points[i - 2];

    // Calcolo distanza percorsa
    totalDistance += Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));

    // Inversioni asse X
    if (Math.sign(curr.x - prev.x) !== Math.sign(prev.x - pPrev.x) && Math.abs(curr.x - prev.x) > 2) {
      xInversions++;
    }
    // Inversioni asse Y
    if (Math.sign(curr.y - prev.y) !== Math.sign(prev.y - pPrev.y) && Math.abs(curr.y - prev.y) > 2) {
      yInversions++;
    }
  }

  // Calcolo della dimensione del Bounding Box
  const width = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
  const height = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  const areaDiagonal = Math.sqrt(width * width + height * height);

  // LOGICA DI IDENTIFICAZIONE:
  // 1. Molte inversioni totali
  // 2. La distanza totale percorsa è molto più grande della diagonale dell'area occupata
  const isDense = totalDistance > areaDiagonal * 3;
  const hasEnoughJiggles = (xInversions + yInversions) > 10;

  console.log(`[UNDO-LOG/analyzeScribble] Analisi: Inversioni(X:${xInversions}, Y:${yInversions}), Densita':${(totalDistance / areaDiagonal).toFixed(2)}`);

  return isDense && hasEnoughJiggles;
}

async function getElementBounds(el) {
  const size = await el.stroke.points.size(); // [cite: 3, 4]
  const points = await el.stroke.points.getRange(0, size); // [cite: 3, 4]
  saveStringTo(JSON.stringify(points), '/sdcard/points2.json');

  let minX = points[0].x, minY = points[0].y;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  });

  return {
    minX: minX - PADDING,
    minY: minY - PADDING,
    maxX: el.maxX + PADDING, // [cite: 5]
    maxY: el.maxY + PADDING  // [cite: 5]
  };
}

function checkOverlap(scribble, target) {
  // Confronto rapido tra i rettangoli di ingombro (Bounding Box) [cite: 5]
  console.log(`[UNDO-LOG/checkOverlap] scribble \n${JSON.stringify(scribble)}`);
  console.log(`[UNDO-LOG/checkOverlap] target \n${JSON.stringify(target)}`);
  return (
    target.maxX >= scribble.minX &&
    (target.maxX - 100) <= scribble.maxX &&
    target.maxY >= scribble.minY &&
    (target.maxY - 100) <= scribble.maxY
  );
}