# Android is the primary device

Timothy uses only an Android phone. Essential creation, conversation, sharing, connector setup and room controls must remain available through touch and the browser. Desktop presentation is secondary.

This revision gives phone-sized viewports (including landscape widths up to 1024 CSS pixels) three bottom destinations: Canvas, Conversation, Room & AI. Switching changes presentation only; widgets, transcripts and drafts remain mounted. Canvas gets its available scene area; Conversation gets a full-height message list and composer; room controls no longer require scrolling below the workspace.

The visual viewport height and offset update the workspace when the Android keyboard changes usable space. The viewport meta tag requests content resizing where supported, retains zoom and permits safe-area padding. Dialogs are scrollable within the available viewport. Landscape/short layouts compact the toolbar. Larger touch targets cover window controls, resize handles and mannequin controls.

Validation: 100 behavioral tests pass, including viewport change and section selection cases. These tests verify event/state behavior, not rendered geometry. Actual Android keyboard, browser chrome, rotation and touch interaction still require device review; no device verification is claimed.
