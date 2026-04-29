# Testing the CS2 Annotations Manager

This walkthrough helps you verify that the app works end-to-end: settings (local + workshop), listing and opening guides, editing nodes, toggling visibility (Enabled), and saving.

## 1. Set up paths (Settings)

1. Run the app: `npm run dev`.
2. Open **Settings** (top nav).
3. Click **Detect from Steam**.  
   - Both **Annotations folder (local)** and **Workshop content folder (CS2 map guides)** should fill in, e.g.:
     - Annotations: `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\annotations\local`
     - Workshop: `C:\Program Files (x86)\Steam\steamapps\workshop\content\730`
4. If Detect fails (e.g. Steam elsewhere), paste the paths manually:
   - Local: `...\game\csgo\annotations\local`
   - Workshop: `...\steamapps\workshop\content\730`
5. Click **Save paths**.

You can set only one of the two if you only use local or only workshop guides.

## 2. See guides (Guides list)

1. Open **Guides** (top nav).
2. Click **Refresh** if the list is empty after changing settings.
3. You should see:
   - **Local guides**: folders under `annotations\local\<name>\` that contain `<name>.txt`.
   - **Workshop guides**: folders under `workshop\content\730\<id>\` that contain **only** `.txt` files; each `.txt` appears as a guide named `<id> - <filename>` (e.g. `3388737112 - mirage_essential`).
4. Workshop entries show a **Workshop** badge.

If you use the path you mentioned (`...\730\3388737112\mirage_essential.txt`), that folder must contain only `.txt` files (no `.vpk`, maps, etc.) for it to be listed.

## 3. Open a guide and see annotations

1. Click a guide in the list (local or workshop).
2. The editor opens: **Nodes** list on the left, **Edit** panel on the right.
3. Select a node in the list to see its fields in the edit panel (Position, Angles, Title, Desc, Enabled, etc.).
4. Check the **Visible in game (Enabled)** checkbox at the top of the edit form: when **off**, that node is hidden in CS2 (KV3 `Enabled` = false).

## 4. Toggle visibility (hide lineups you don’t want)

- **In the node list**: use the checkbox next to each node to turn **Visible** on/off without opening the form. Uncheck to hide that node in game.
- **In the edit panel**: when a node is selected, the first option is **Visible in game (Enabled)**. Uncheck to hide it.
- Then click **Save**.  
- For workshop guides, saving writes to the workshop folder; if the folder is read-only (e.g. Steam), you’ll get an error—in that case you can copy the file elsewhere or run the app with write access.

After saving, run **annotation_reload** (or **annotation_load &lt;name&gt;** for local) in the CS2 console so the game reloads the file and your visibility changes apply.

## 5. Copy reload command

1. In the editor, click **Copy reload command**.
2. Paste in the CS2 console and run it (e.g. `annotation_reload`) after you’ve saved in the app.

## 6. Create a new local guide

1. In **Guides**, enter a name in **New guide name** and click **New guide**.
2. The new guide is created under the annotations folder and opens in the editor with no nodes.
3. Use **Add** to add nodes (Position, Text, Grenade, etc.), edit them, then **Save**.

## 7. Quick checklist

- [ ] Settings: Detect from Steam fills both paths; Save paths persists them.
- [ ] Guides: Local guides appear; workshop guides (txt-only folders under 730) appear with Workshop badge.
- [ ] Open guide: Nodes load; selecting a node shows the edit form.
- [ ] Visibility: Checkbox in node list toggles Enabled; Visible in game in form does the same; Save persists it.
- [ ] Save: No error; after annotation_reload in CS2, visibility/labels match the app.
- [ ] New guide: Creates folder + file; can add nodes and save.

## Workshop path you mentioned

Your path:

`C:\Program Files (x86)\Steam\steamapps\workshop\content\730\3388737112\mirage_essential.txt`

- **Workshop content folder** in Settings should be:  
  `C:\Program Files (x86)\Steam\steamapps\workshop\content\730`
- The app scans subfolders (e.g. `3388737112`) and only treats a folder as a “map guide” source if it contains **only** `.txt` files (no `.vpk`, `.vmap`, etc.).
- Each `.txt` in such a folder becomes one guide, e.g. `3388737112 - mirage_essential`.

If that folder has other file types, it won’t be listed. If you want to include folders that have both `.txt` and other files, the logic would need to be relaxed (e.g. “has at least one .txt” and list those .txt files only).
