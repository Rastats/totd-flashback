---
description: Package and archive a new plugin version
---

# Plugin Version Release Workflow

// turbo-all

## Steps

1. **Update version number** in `Latest/info.toml`:
   - Increment the version (e.g., `1.31.0` -> `1.31.1`)
   - This is REQUIRED for every release

2. **Verify changes compile**:
   - Open Trackmania with Openplanet
   - Check for any compilation errors in the log

3. **Clean old packages** (important - prevents bloated archives):
   ```powershell
   cd "d:\Jeux Vidéos\Speedruns\Marathons\TOTD Flashback\Site web + Plugin\Plugin Flashback"
   Remove-Item "Latest\*.op" -Force -ErrorAction SilentlyContinue
   ```

4. **Package the plugin** (creates .op inside Latest):
   ```powershell
   Compress-Archive -Path "Latest\*" -DestinationPath "Latest\TOTD_Flashback_X.XX.X.zip" -Force
   Rename-Item "Latest\TOTD_Flashback_X.XX.X.zip" "TOTD_Flashback_X.XX.X.op"
   ```

5. **Copy to version folder** (archive the source code):
   ```powershell
   New-Item -ItemType Directory -Path "X.XX.X" -Force
   Copy-Item -Path "Latest\*" -Destination "X.XX.X\" -Recurse -Force
   ```

6. **Copy to Openplanet plugins folder** (optional - removes old versions):
   ```powershell
   Remove-Item "$env:USERPROFILE\OpenplanetNext\Plugins\TOTD_Flashback_*.op" -Force -ErrorAction SilentlyContinue
   Copy-Item "Latest\TOTD_Flashback_X.XX.X.op" "$env:USERPROFILE\OpenplanetNext\Plugins\" -Force
   ```

7. **Commit changes** (if applicable):
   ```powershell
   git add .
   git commit -m "chore: Release plugin vX.XX.X"
   ```

Replace `X.XX.X` with the new version number throughout.

## Reminders

> [!IMPORTANT]
> **Always update the version number before packaging!**
