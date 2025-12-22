// Script to add mapId to totds.ts from TOTD_Data.tsv
const fs = require('fs');
const path = require('path');

// Read TSV file
const tsvPath = path.join(__dirname, '../Plugin Flashback/TOTD_Data.tsv');
const tsv = fs.readFileSync(tsvPath, 'utf-8');

// Parse TSV - columns: Index, Date, Name, Mapper, Author, Gold, Map UID, Map ID, ...
const lines = tsv.split('\n').slice(1); // Skip header
const mapIdByIndex = new Map();

for (const line of lines) {
  if (!line.trim()) continue;
  const cols = line.split('\t');
  const index = parseInt(cols[0], 10);
  const mapId = cols[7]; // Map ID is column 8 (0-indexed: 7)
  if (index && mapId) {
    mapIdByIndex.set(index, mapId);
  }
}

console.log(`Loaded ${mapIdByIndex.size} map IDs from TSV`);

// Read current totds.ts
const totdsPath = path.join(__dirname, 'src/data/totds.ts');
const totdsContent = fs.readFileSync(totdsPath, 'utf-8');

// Update interface to include mapId
let newContent = totdsContent.replace(
  /export interface TOTDEntry \{[\s\S]*?\}/,
  `export interface TOTDEntry {
  id: number;
  date: string;
  name: string;
  authorName: string;
  mapUid: string;
  mapId: string;
}`
);

// Add mapId to each entry
// Match entries like: { "id": 1, ..., "mapUid": "xxx" }
let count = 0;
newContent = newContent.replace(
  /\{\s*"id":\s*(\d+),\s*"date":\s*"([^"]+)",\s*"name":\s*"([^"]*)",\s*"authorName":\s*"([^"]*)",\s*"mapUid":\s*"([^"]*)"\s*\}/g,
  (match, id, date, name, author, uid) => {
    const mapId = mapIdByIndex.get(parseInt(id, 10)) || '';
    count++;
    return `{
    "id": ${id},
    "date": "${date}",
    "name": "${name}",
    "authorName": "${author}",
    "mapUid": "${uid}",
    "mapId": "${mapId}"
  }`;
  }
);

console.log(`Updated ${count} entries with mapId`);

// Write back
fs.writeFileSync(totdsPath, newContent);
console.log('Done! Updated totds.ts with mapId field');
