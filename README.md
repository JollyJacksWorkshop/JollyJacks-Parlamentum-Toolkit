# JollyJack's Parlamentum Toolkit V1.1

Offline Windows/browser planning toolkit for the Parlamentum game. This release focuses on simplifying the Supply Chain Builder. **It is not affiliated with Parlamentum and does not connect to game accounts or live markets.**

## What's changed from V1

- **Supply Chain profitability is front and center.** Revenue, employee wages, net operating cash flow, and gold proceeds appear immediately above the chain canvas. The detailed Profitability view explains every company and market block.
- **Advanced Settings are optional.** The straightforward flow is: save company/worker/region/country profiles → add companies → connect material flows → add a Market block → enter sale prices and (for global sales) a gold/USD rate → select how many work shifts to simulate.
- **Worker profiles no longer ask for planned shifts or allocated energy.** A shift is one hypothetical work action, with its maximum work energy calculated automatically from character level. Work fatigue is applied in consecutive shift projections. The simulator **does not** verify that players have earned enough energy or can work so many shifts in real time.
- **Quick shift controls** at the top of each chain: choose 1, 3, 10, or any other positive number up to 2,000. The chain-wide setting represents that many total worker-shifts **per company**, NOT that many shifts per individual employee. Shifts distribute evenly across that company's workers by default.
- **Optional per-company shift overrides** and optional per-worker allocations are available by selecting a company block, not in Advanced Settings. When manually assigning workers, the sum of their counts controls the total shifts for that company.
- **Simplified market selling:** a Market block displays normal editable price inputs for products feeding into it. The seller country is inferred from connected companies/regions when possible. If unclear (including a mixed-country supply), specify the seller country on the block.
- **Existing V1 data stays compatible.** The Windows launcher continues using the original application settings location, and browser V1.1 uses the same localStorage key. Because standalone HTML file origins may differ, users of the browser-only version should export a full V1 backup and import it into V1.1.
- **Both builder side panels remain collapsible.** Saved companies, countries, regions, templates, custom images, linked workers, independent worker profiles, calculator library, and full data backup/restore remain.

## Get started

**Windows:** Extract `JollyJacks_Parlamentum_Toolkit_V1.1_Windows.zip`, then double-click `JollyJacks_Parlamentum_Toolkit_V1.1.exe`. It opens a local offline browser UI. No Python or Node required to run. Saved data is kept in your Windows user config folder (usually `%APPDATA%\JollyJacksParlamentumToolkit\settings.json`). Keep the .exe open during use. This Windows executable is self-built and unsigned; if Windows warns you, review the contents/source rather than automatically bypassing security prompts.

**Browser:** Extract `JollyJacks_Parlamentum_Toolkit_V1.1_Browser.zip` and double-click `JollyJacks_Parlamentum_Toolkit_V1.1.html`. The HTML file is self-contained and works offline. Use Settings → Export full backup before moving the file or clearing browser storage.

## Required information and results

Production requires a saved company with category/product/tier/level, a linked region with Industry and Electricity indexes, suitable workers with Economy/Education/character level (or a complete owner player profile), and a **known** production tax for raw material mines (zero is valid). Paid workers require the base wage and wage multiplier. Country-specific FX is required to calculate USD payroll. Market sales require a venue, prices, applicable tax, and FX for USD conversion.

All player-specific data starts blank on a new installation. Blank taxes, bonuses, prices, skill levels, and regions do not mean zero. Incomplete information displays warnings and blocks finalized profitability rather than silently assuming zero taxes. The toolkit estimates profitability if goods sell at the entered prices; it does **not** include capital expenditure, inventory purchase cost basis, or a guarantee of market demand. Stored/unsold goods are not counted as cash revenue.

The nine calculators cover production, payroll, markets and exports, iron-to-weapons, gold-to-cash, combat, upgrades, training, and energy. Standalone company calculators use one hypothetical shift by default, with shift counts adjustable in their calculator forms where applicable.

## Sharing and backups

Name, save, load, duplicate, export, and import chains and templates as JSON. Exports retain block positions, connections, market prices, override shift settings, per-worker allocations, company snapshots and optional advanced assumptions. Use Settings for full database backups.

## Source build / tests

The ZIP source contains Go server launcher, self-contained HTML build script, engine/app/css, logo asset and test suites.

- `python build.py` regenerates the V1.1 HTML and Windows-embedded `assets/index.html`.
- `node tests/v11.test.js` runs formula, shift, wage, material, tax and chain unit tests.
- `python tests/v11_smoke.py` runs browser UI smoke tests if Playwright and Chromium are available.
- `GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -H=windowsgui" -o JollyJacks_Parlamentum_Toolkit_V1.1.exe .` cross-compiles the launcher on a system with Go installed.

Earlier V1 profile fields for planned shifts / allocated energy remain harmless if they occur in old imported backups, but they are not used by V1.1 simulations.
