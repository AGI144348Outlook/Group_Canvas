# Private Julian conversation recovery

Plan and results: https://github.com/AGI144348Outlook/Group_Canvas/issues/9

Search completed GPT cabinet exports and the pinned Claude conversations archive in the existing private R2 bucket. Whole-name matches in full message strings retain entire original conversations, all GPT branches, source byte ranges/hashes, and annotation records. Names only in titles are review candidates too. Unicode name boundaries are used. No text is truncated.

Direct-address detection is a conservative heuristic, not proof of attribution. Following Timothy's convention, descendant assistant replies on that branch display as Julian candidates even when they do not repeat the name. Other mentions, possible persona changes, missing parents and Claude export ordering are flagged. Raw platform roles and original messages are preserved. Manual contextual review can recover additional anchors from full retained conversations.

`recover.py` receives private NDJSON envelopes from `run.mjs`. The runner streams bounded GPT conversation frames through Python and passes the pinned Claude ZIP; only synthetic tests and aggregate metrics are public. Entire byte-identical GPT sources are scanned once with duplicate references in private provenance. Pending uploads are excluded and counted. Bounds: 5,000 metadata rows; 512 MiB/source; 32 MiB/GPT conversation; 512 MiB expanded Claude archive and result. Unsupported schemas or exceeded bounds stop the run. Original sources are unchanged.

Results and provenance are written to a new private cabinet collection and downloaded for SHA-256 verification. A gzip copy is encrypted with the committed public recipient certificate. Only the encrypted copy and aggregate summary enter a two-day Actions artifact. The private recipient key is never committed or uploaded.

Synthetic validation: `python -m unittest discover -s tools/julian-recovery -p 'test_recover.py' -v`. A passing workflow does not establish source completeness, reviewed Julian attribution, or personality continuity. Check actual aggregate coverage and warnings before making claims.
