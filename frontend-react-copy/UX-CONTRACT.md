# SpamChameleon UX Contract

Observable behaviour that every screen shares. Visual values live in DESIGN.md.

## Navigation

- Six destinations: Home, Spam, Malware, Process, Assistant, History. The URL hash is the route (`#/spam`, `#/history`, ...); unknown hashes fall back to Home.
- Desktop: a sidebar groups them (Detect, Assist, Session). Below 960px: a top bar plus a five-tab bar (every destination except Home; the brand mark goes home).
- Each route sets `document.title` to "<Page> · SpamChameleon". Changing route moves focus to the page heading.
- The session prediction history is held in App state and resets on reload. The History item shows the count.
- The screen follows the system light/dark appearance; when it changes the current screen is rebuilt so charts re-read their colours.

## Model screens (Spam, Malware, Process)

- Operation: input, then **Check / Scan File / Predict**, then pending (spinner, same button width), then the result in the report column. A failure shows an inline alert above the button and keeps the input.
- The report column always exists. Empty state: "No Result Yet". A result shows the verdict block (probability ring, verdict word, one explanatory line), the evidence and the charts. **Dismiss** returns to the empty state and never clears the input.
- The ring shows the probability of the risky class (spam, malware); for Process it shows the position in the training range.
- A new result moves focus to the report so keyboard and screen-reader users land on it.
- Every successful prediction is recorded once in history, with the same shape as before.
- Enter submits the Spam and Assistant textareas; Shift+Enter adds a line.
- Forms use `noValidate`; out-of-training-range numbers are flagged inline in amber, never blocked.
- Malware binary features are switch rows; numeric features and Process counters are label/value rows in an inset list.

## Search / filter

- The Malware feature search filters locally and immediately. When non-empty it shows a clear button (label "Clear search") that empties the field and returns focus to it.

## Destructive actions

- History "Clear history" opens an inline confirmation naming the count, with **Cancel** focused first and **Yes, clear** as the danger action. No native dialogs.

## Feedback and states

- Errors: inline `Alert` with `role="alert"`. Info: `role="status"`.
- Loading: spinner and a sentence; reserve the final footprint to avoid layout shift.
- Empty and no-results states have a heading, a sentence and, where useful, one action.
- Backend status is shown in the navigation (checking / ready / offline) and never blocks the UI.


## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native `<select>` styled with `.select` (OS popup accepted: short English option lists, no popup geometry in the visual contract) | src/styles/base.css | Disabled with explanatory option text (History verdict for the Process model) | Manual: open popup, keyboard select, narrow viewport |
| Date | Native `input[type=date]` styled with `.textinput` (browser locale and picker accepted; range checked in app code) | src/views/HistoryView.jsx | None | Manual: from/to order error message, narrow viewport |
| Form | `noValidate` forms with app-owned inline `Alert` errors and `NumberField` range hints | src/components/Alert.jsx, src/components/NumberField.jsx | Busy submit keeps button width (`butt-wide`) | Manual: submit empty, submit failing, duplicate submit |
| Scrollbar | One global baseline in `base.css` (thin, tokenised thumb, WebKit fallback, forced-colors) | src/styles/base.css | None; internal scrollers are the chat log, feature list and table wrapper | Manual: each scroller shows the baseline |
| Dialog | Native `<dialog>` for About; inline `alertdialog` block for destructive History clear | src/components/AboutDialog.jsx, src/views/HistoryView.jsx | None | Manual: focus trap, Escape, focus restoration, Cancel focused first |
| Search | Filled search field with magnifier and clear button, local immediate filtering | src/views/MalwareView.jsx | None (no remote search, so no debounce) | Manual: type, clear returns focus to input |
| Table | Native `<table>` in `.history-table-wrap`, client-side "Show more" in steps of 20, cards under 720px | src/views/HistoryView.jsx, src/styles/history.css | None | Manual: filter, expand details, narrow viewport |

