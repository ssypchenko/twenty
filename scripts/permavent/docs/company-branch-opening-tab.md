# Company and Branch opening tab

Available from `v2.35.2-permavent.4`. Enable `Permavent Company and Branch Wide
Side Panel` in Workspace Settings → Labs, then reload the application.

## Selection priority

1. Use an available tab previously selected for the same record in the current
   browser application state. This selection is independent for each record
   and resets on page refresh.
2. Otherwise use the opening tab saved in that record's layout.
3. If the layout has no explicit preference, use the installed Permavent Sales
   History tab. Renaming the tab does not change its identity.
4. If the preferred tab is hidden, removed or unavailable, use an available
   fallback tab.

Company and Branch layouts can have different preferences. The saved
preference is shared by users of that layout and applies to the side panel
and mobile record page. Desktop full-page behaviour is unchanged.

## Change the opening tab

1. Open a Company or Branch and enter the existing layout edit mode.
2. Open the desired tab's settings and select `Use as opening tab`.
3. Save the layout. `Default opening tab` identifies the selected preference.
   Cancel discards an unsaved change.
4. Reload and open a record to check the preference without a remembered
   selection taking precedence.

The setting uses the existing layout edit permission and the existing
`defaultTabToFocusOnMobileAndSidePanelId` relation. A new tab can be created and
selected as the opening tab in one save. Removing the selected tab clears the
relation. No new table or schema migration is required.

## Regression checks

- Open a Company and Branch without a remembered selection; confirm Sales
  History when no explicit preference is saved.
- Select another tab and reopen that record; confirm that its remembered
  selection wins and does not affect another record.
- Save a different opening tab, reload and confirm it on the side panel and
  mobile record page. Cancel another edit and confirm the saved preference.
- Hide or remove the preferred tab and confirm an available fallback.
- Create and select a new opening tab in the same save.
- Confirm existing edit permissions and normal behaviour for other objects
  and when the Labs flag is disabled.

## Undo the preference or release

Choose another opening tab and save to change the preference. Disable the
existing Labs flag to remove the Permavent extension. Restore the previously
accepted image through the installed deployment procedure to undo the
release. Existing saved tab relations remain compatible with the previous
application version.
