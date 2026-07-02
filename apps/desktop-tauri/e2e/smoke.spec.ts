describe('CS2 Annotations Manager (Tauri) — smoke', () => {
  it('launches and shows the scaffold placeholder', async () => {
    // The webview session connects before the React app has finished its
    // first render, so an immediate getText() can race an empty <body>.
    // waitUntil polls until the app has actually painted.
    await browser.waitUntil(
      async () => (await $('body').getText()).includes('CS2 Annotations Manager'),
      {
        timeout: 10000,
        timeoutMsg: 'expected body to contain "CS2 Annotations Manager" after 10s',
      }
    )
    const text = await $('body').getText()
    expect(text).toContain('CS2 Annotations Manager')
  })
})

// NOTE: a "create guide -> save -> reload from disk" scenario belongs here,
// but requires App.tsx to render the real Guides UI (Task 14) and a way to
// point the app at a scratch annotations folder (Task 10's Settings UI).
// Added in Task 14, Step "extend E2E coverage", not here — TauriAdapter's
// behavior is already covered by the vitest suite above.
