# Source gate flow

```
sources.lock.yaml (human artefact)  ──►  SourceNotClearedError (runtime check)
        ▲                                          ▲
        │                                          │
   Phase 0 (human, in a browser)        Module 2 (ingestion, only after ↑)
```

- `config/sources.lock.yaml` is written by a human after verification (see `docs/sources/CHECKLIST.md`).
- `ingestion/gate.py` reads it and raises `SourceNotClearedError` before any HTTP call if the source is absent or not cleared.
- Module 2 ingestion depends on the gate and on nothing else.
