# Madlibs Interface Mockups

## Chat/CLI Flow #1 - Edit Session

```
User: !madlib edit general
Bot: Editing category `general`.
Bot: Choose an action:
     [1] Add word  [2] Remove word  [3] Add pattern  [4] Remove pattern
     [5] List vocab  [6] List patterns  [7] Export  [8] Save  [9] Cancel

User: 1
Bot: Enter vocab type (without brackets):
User: noun
Bot: Enter word:
User: lighthouse
Bot: Added `lighthouse` to `[noun]` in `general`.
Bot: Next action? (1-9)

User: 3
Bot: Enter pattern (use [type] tokens):
User: the [adj] [noun] [verb]ed over the [noun]
Bot: Added pattern to `general`.
Bot: Next action? (1-9)

User: 8
Bot: Saved `general`. Exiting edit session.
```

## Chat/CLI Flow #3 - Slash Command + Modal

```
/madlib generate category:general
/madlib add-word category:general type:noun word:lighthouse
/madlib add-pattern category:general pattern:"the [adj] [noun] [verb]ed over the [noun]"
/madlib list category:general
/madlib export category:general
```

Modal (opened from /madlib add-word):
```
┌──────────────────────────────┐
│ Add Madlib Word              │
├──────────────────────────────┤
│ Category:  [general        ] │
│ Type:      [noun           ] │
│ Word:      [lighthouse     ] │
│                              │
│ [Cancel]        [Save]       │
└──────────────────────────────┘
```

Modal (opened from /madlib add-pattern):
```
┌──────────────────────────────────────────────┐
│ Add Madlib Pattern                           │
├──────────────────────────────────────────────┤
│ Category:  [general                        ] │
│ Pattern:   [the [adj] [noun] [verb]ed ... ] │
│                                                │
│ [Cancel]                      [Save]          │
└──────────────────────────────────────────────┘
```

## GUI Flow #4 - Web Admin Panel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Madlibs Admin                                                               │
├───────────────┬─────────────────────────────────────────────────────────────┤
│ Categories    │ general                                                     │
│───────────────│ ┌──────────────────────────────┬───────────────────────────┐ │
│ • general     │ │ Patterns                     │ Vocab                     │ │
│ • hippy (RO)  │ │ [adj] [noun] ...             │ [noun]                     │ │
│ • corpo (RO)  │ │ the [adj] [noun] ...         │  - lighthouse              │ │
│ • sci-fi      │ │ ...                          │  - engine                  │ │
│               │ │ [Add] [Remove] [Import]      │  [Add] [Remove] [Import]   │ │
│               │ └──────────────────────────────┴───────────────────────────┘ │
├───────────────┴─────────────────────────────────────────────────────────────┤
│ [Export JSON]  [Save]  [Discard]                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:
- RO = read-only (built-ins).
- Import/Export operate on per-category JSON files.
