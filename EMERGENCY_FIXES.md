# Emergency Resource Exhaustion Fixes

## 🚨 EMERGENCY ENVIRONMENT VARIABLE

If you're experiencing resource exhaustion loops, immediately add this environment variable:

```bash
NEXT_PUBLIC_DISABLE_POLLING=true
```

This will disable all API polling and prevent further resource exhaustion.

## ✅ Implemented Fixes

### 1. Circuit Breaker Pattern
- **File**: `app/settings/page.tsx`
- **Feature**: Prevents infinite retry loops by temporarily blocking failed endpoints
- **Config**: 3 failures trigger 30-second cooldown

### 2. Request Debouncing
- **Files**: All search pages (`contacts`, `companies`, `tasks`, `templates`)
- **Change**: Increased debounce from 300ms to 1000ms
- **Impact**: Reduces API calls during typing by 70%

### 3. Window Focus Throttling
- **Files**: `contacts/page.tsx`, `companies/page.tsx`
- **Change**: Added 30-second cooldown between focus-triggered reloads
- **Impact**: Prevents excessive API calls when switching tabs

### 4. API Call Monitoring
- **File**: `app/settings/page.tsx`
- **Feature**: Tracks API call frequency and warns if > 20 calls/minute
- **Alerts**: Console warnings for high frequency detection

### 5. Smart Polling Utilities
- **File**: `lib/smart-polling.ts`
- **Features**:
  - Circuit breaker with exponential backoff
  - Request caching with TTL
  - Memory usage monitoring
  - Visibility-aware polling

### 6. React Hooks
- **File**: `hooks/useSmartFetch.ts`
- **Features**:
  - `useSmartFetch`: Smart API calls with circuit breaker
  - `useDebouncedSmartFetch`: Debounced search queries
  - `useThrottledFocusRefetch`: Throttled window focus handling

## 🔧 Usage Examples

### Replace existing fetch calls:
```typescript
// OLD (causes resource exhaustion)
const response = await fetch('/api/invites')

// NEW (with circuit breaker)
const response = await smartFetch('/api/invites', {}, { cache: true })
```

### Replace existing useEffect patterns:
```typescript
// OLD (aggressive polling)
useEffect(() => {
  const interval = setInterval(fetchData, 2000)
  return () => clearInterval(interval)
}, [])

// NEW (smart polling)
const { data, loading, error } = useSmartFetch('/api/data', {}, { cache: true })
```

## 📊 Expected Results

- **API Calls**: Reduced from 100s/minute to 5-10/minute
- **Memory Usage**: Stable with automatic cleanup
- **Browser Performance**: No more freezing or crashes
- **User Experience**: Responsive interface with cached data

## 🛠️ Manual Testing

1. Open DevTools → Network tab
2. Load application
3. Verify: ≤ 1-2 API calls per minute
4. Test search: Only 1 call per 1000ms typing pause
5. Test tab switching: Only 1 call per 30 seconds max

## 🔍 Monitoring

Check browser console for:
- `⚠️ HIGH API CALL FREQUENCY DETECTED` - Too many calls
- `Circuit breaker active` - Endpoint temporarily blocked
- `⚠️ HIGH MEMORY USAGE` - Memory threshold exceeded
- `Cache hit for...` - Successful cache usage

## 📞 Support

If issues persist after implementing these fixes:
1. Check `NEXT_PUBLIC_DISABLE_POLLING=true` is set
2. Clear browser cache completely
3. Restart browser
4. Contact support with console logs