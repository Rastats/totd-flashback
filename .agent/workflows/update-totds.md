---
description: Update totds.ts with new TOTD data from trackmania.io API
---

# Update TOTDs Workflow

Use this workflow to add new TOTD entries to `src/data/totds.ts` when new TOTDs are released.

## Prerequisites
- The TOTD must have been released (check on trackmania.io)
- Know which TOTD number(s) you want to add (e.g., 1999, 2000)

## Steps

### 1. Fetch current TOTD data
Fetch the data from trackmania.io API:
```
https://trackmania.io/api/totd/0
```

This returns the current month's TOTDs in the `days` array.

### 2. Find the target TOTD
Each entry in `days` has:
- `monthday`: Day of the month (1-31)
- `map`: Map details
- `leaderboarduid`: Leaderboard UID

### 3. Transform the data
For each TOTD to add, create an entry with this format:

```typescript
{
  "id": TOTD_NUMBER,                          // Sequential number (1999, 2000, etc.)
  "date": "DD/MM/YYYY",                       // Format from monthday + month + year
  "name": FILENAME_WITHOUT_MAP_GBX,           // map.filename with ".Map.Gbx" removed
  "authorName": map.authorplayer.name,
  "authorTime": map.authorScore,
  "goldTime": map.goldScore,
  "mapUid": map.mapUid,
  "mapId": map.mapId,
  "authorId": map.author,
  "zone": map.authorplayer.zone.flag,         // Use the "flag" field from innermost zone
  "leaderboardUid": leaderboarduid,
  "silverTime": map.silverScore,
  "bronzeTime": map.bronzeScore
}
```

### 4. Field mapping reference

| totds.ts field | API field | Notes |
|----------------|-----------|-------|
| id | (calculate) | Sequential TOTD number |
| date | monthday + month + year | Format as DD/MM/YYYY |
| name | map.filename | **Remove ".Map.Gbx" suffix** |
| authorName | map.authorplayer.name | Clean name without tags |
| authorTime | map.authorScore | In milliseconds |
| goldTime | map.goldScore | In milliseconds |
| mapUid | map.mapUid | Used for trackmania.io links |
| mapId | map.mapId | UUID format, used for thumbnails |
| authorId | map.author | Author UUID |
| zone | map.authorplayer.zone.flag | Innermost zone flag |
| leaderboardUid | leaderboarduid | From day entry, not map |
| silverTime | map.silverScore | In milliseconds |
| bronzeTime | map.bronzeScore | In milliseconds |

### 5. Add to totds.ts
Add the new entry/entries at the end of the `totds` array in:
```
Site Flashback/src/data/totds.ts
```

Make sure to add a comma after the previous entry before adding the new one.

### 6. Commit and push
```
git add -A
git commit -m "data: Add TOTD #XXXX to totds.ts"
git push origin main
```

## Example

For TOTD #1999 (December 20, 2025), if the API returns:
```json
{
  "monthday": 20,
  "map": {
    "filename": "Some Cool Map.Map.Gbx",
    "authorScore": 45000,
    "goldScore": 48000,
    "silverScore": 55000,
    "bronzeScore": 68000,
    "mapId": "abc123-...",
    "mapUid": "XYZ789...",
    "author": "author-uuid",
    "authorplayer": {
      "name": "MapperName",
      "zone": { "flag": "FRA" }
    }
  },
  "leaderboarduid": "lb-uuid"
}
```

The entry would be:
```typescript
{
  "id": 1999,
  "date": "20/12/2025",
  "name": "Some Cool Map",
  "authorName": "MapperName",
  "authorTime": 45000,
  "goldTime": 48000,
  "mapUid": "XYZ789...",
  "mapId": "abc123-...",
  "authorId": "author-uuid",
  "zone": "FRA",
  "leaderboardUid": "lb-uuid",
  "silverTime": 55000,
  "bronzeTime": 68000
}
```
