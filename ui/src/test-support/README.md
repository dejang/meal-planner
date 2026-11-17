# Test support

The shared test harness: typed IPC and plugin mocks with defaults, the real store
providers for mounting, and fixtures. Tests mount real stores and mock only the backend
boundary, not store actions. Import the IPC harness before stores or features so its
mocks are in place when they load.
