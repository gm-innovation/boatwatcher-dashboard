

# Fix: ControlID `order` parameter format

## Problem
The `lastPollResponse` reveals the exact error:
```json
{"error":"Invalid member 'order' (array expected, got object)","code":1}
```

The agent sends `order` as an object (`{ access_logs: { id: "ASC" } }`), but the ControlID API expects it as an **array**.

## Fix

### `electron/agent.js` — Change `order` to array format

Current (broken):
```javascript
payload.order = { access_logs: { id: 'ASC' } };
```

Fixed:
```javascript
payload.order = [{ access_logs: { id: 'ASC' } }];
```

Also wrap `where` in an array for consistency with the API format:
```javascript
if (lastEventId > 0) {
  payload.where = [{ access_logs: { id: { '>': lastEventId } } }];
}
```

### `server/package.json` — Bump to 1.3.5

### Files changed
- `electron/agent.js` — fix `order` and `where` to use arrays
- `server/package.json` — version 1.3.5

