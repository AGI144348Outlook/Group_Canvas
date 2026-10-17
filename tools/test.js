// Run in one process so the test reporter includes each behavioral case.
await import('../test/engine.test.js');
await import('../test/api.test.js');
await import('../test/room.test.js');
await import('../test/connector.test.js');

await import('../test/scene.test.js');

await import('../test/environment.test.js');
await import('../experiments/vision-token/test/model.test.js');
await import('../test/conversation.test.js');
