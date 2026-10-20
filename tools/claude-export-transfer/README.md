# Claude export copy to existing private R2

Timothy requested copying the Claude export files uploaded to Echo Green Future's `main/docs/` into the same private R2 bucket as GPT conversations, in a separate folder/prefix.

`source-manifest.json` pins the source commit, names, byte sizes and Git blob identities. At intake, six ZIPs and the original export manifest were present. `frames-000.zip` was absent and is explicitly reported missing; its absence is not repaired by an empty placeholder.

The separate object prefix is `claude-exports/2026-10-20/` in `group-canvas-citadel-sources`. Original filenames are retained. This is a physical R2 prefix, not a new bucket. It is not automatically registered in the cabinet's collection inventory; cabinet visibility would require a separate supported registration path.

The workflow uses existing Cloudflare Actions credentials. It downloads all pinned GitHub sources, checks byte count and Git blob SHA-1, verifies ZIP CRCs without extraction or execution, then copies each file. Full R2 read-back must match SHA-256 and byte count. Existing matching objects are verified and reused; conflicting objects stop the run. No source files, GPT objects, bucket settings or public-access settings are changed. This is a bounded single-workflow copy, not a general concurrent storage service.

`transfer-provenance.json` is saved privately beside the archives, and a metadata-only result artifact is retained for seven days. The original export manifest may contain expiring links; its bytes remain unchanged in private storage and are not printed in logs or copied into the result artifact. No private archive content is logged, committed to Group Canvas, or used for training.

Six synthetic tests cover successful copy and idempotent retry, collision preservation, corrupt read-back, truncated source, incorrect source identity, and invalid destinations/paths. Passing these tests is not proof of a successful live transfer; the Actions run and verified result determine that.

The source repository was reported public at inspection. This copy does not remove those public source files or their Git history, or change repository visibility.
