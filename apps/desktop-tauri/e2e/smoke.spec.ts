// Real "create guide" E2E scenario (Task 14, Step 8). Selectors below were
// taken from reading the actual JSX in packages/ui/src/Guides.tsx and
// packages/ui/src/Settings.tsx — NOT the brief's placeholder guesses
// (`button=New Guide`, `button=Create`, `input[type="text"]`), which don't
// match this app's real UI:
//   - Guides.tsx has no separate "Create" step: the "New guide" button (its
//     text is lowercase "guide", not "Guide") both creates the file *and*
//     immediately opens it in GuideEditor.
//   - The guide-name field is one of several `input[type="text"]` elements
//     on the page (name filter, map name…), so it's targeted by its
//     placeholder instead.
//   - Settings.tsx's annotations-folder input has no accessible name/id, so
//     it's targeted via its preceding <label> through an XPath
//     following-sibling axis, which also sidesteps CSS-selector escaping
//     pitfalls with the backslashes in its placeholder text
//     ("...\game\csgo\annotations\local").
//
// Route chosen for seeding the annotations root: drive the real Settings
// UI (gear icon -> fill folder path -> Save -> close), rather than the
// brief's documented fallback of pre-seeding tauri-plugin-store's
// settings.json on disk. The UI route exercises the actual Settings
// component end-to-end and proved reliable, so the fallback wasn't needed.
//
// The scratch folder itself (C:\Temp\cs2ann-tauri-e2e\annotations) is
// created fresh and emptied by wdio.conf.ts's onPrepare hook before every
// run, so this scenario is idempotent across repeated local runs.
const ANNOTATIONS_ROOT = 'C:\\Temp\\cs2ann-tauri-e2e\\annotations'
const GUIDE_NAME = 'E2E_Smoke_Guide'

describe('CS2 Annotations Manager (Tauri) — smoke', () => {
  it('launches and shows the guides UI', async () => {
    const body = await $('body')
    await body.waitForExist({ timeout: 15000 })
    const text = await body.getText()
    expect(text).not.toBe('')
  })

  it('sets the annotations folder in Settings', async () => {
    const settingsButton = await $('button[title="Settings"]')
    await settingsButton.waitForExist({ timeout: 15000 })
    await settingsButton.click()

    // Settings.tsx's folder input has no id/name/aria-label, so it's
    // targeted via its preceding <label> text through XPath — CSS attribute
    // selectors would need every backslash in the placeholder text
    // double-escaped and are more brittle here.
    const folderInput = await $(
      '//label[text()="Annotations folder (local)"]/following-sibling::input'
    )
    await folderInput.waitForExist({ timeout: 10000 })
    await folderInput.setValue(ANNOTATIONS_ROOT)

    const saveButton = await $('button=Save')
    await saveButton.click()

    // Close the Settings modal (App.tsx renders it with a "✕" button).
    const closeButton = await $('button=✕')
    await closeButton.click()
    await closeButton.waitForExist({ reverse: true, timeout: 5000 })
  })

  it('creates a guide and it appears in the guide list', async () => {
    const nameInput = await $('input[placeholder="Guide name (e.g. cache_nades)"]')
    await nameInput.waitForExist({ timeout: 15000 })
    await nameInput.setValue(GUIDE_NAME)

    // Guides.tsx's create button reads "New guide" (lowercase "guide") and
    // both creates the file and opens it immediately — there is no
    // separate "Create" confirmation step.
    const newGuideButton = await $('button=New guide')
    await newGuideButton.click()

    // On success the app navigates straight into GuideEditor, whose title
    // bar renders the guide name in an <h2>.
    const editorHeading = await $('h2=' + GUIDE_NAME)
    await editorHeading.waitForExist({ timeout: 15000 })
    expect(await editorHeading.isExisting()).toBe(true)

    // Navigate back to the guide list and confirm it's listed there too.
    const backButton = await $('button=← Back')
    await backButton.click()

    // Deviation from the brief's bare `*=text` selector: WebdriverIO
    // resolves an untagged `*=`/`=` text selector to the "partial link
    // text"/"link text" WebDriver locator strategy, which only matches
    // `<a>` anchor elements — it silently never matches anything else (as
    // observed: this hung for the full timeout against the guide list's
    // `<span>{g.name}</span>` in Guides.tsx). Prefixing with the real tag
    // (`span=`) makes WebdriverIO use an XPath text match instead, which
    // works against any element.
    const guideEntry = await $('span=' + GUIDE_NAME)
    await guideEntry.waitForExist({ timeout: 10000 })
    expect(await guideEntry.isExisting()).toBe(true)
  })
})
