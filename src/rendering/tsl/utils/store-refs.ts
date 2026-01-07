/**
 * TSL Store Subscription Refs
 *
 * React refs that stay synchronized with Zustand store state
 * via subscriptions. Avoids getState() calls in render loops.
 *
 * 100% parity with WebGL store ref pattern.
 *
 * @module rendering/tsl/utils/store-refs
 */

import type { MutableRefObject } from 'react'

/**
 * Store subscription result
 */
export interface StoreSubscription<T> {
  /** Current state ref */
  stateRef: MutableRefObject<T>
  /** Unsubscribe function */
  unsubscribe: () => void
}

/**
 * Create a subscription-based ref for a Zustand store.
 *
 * Instead of calling getState() every frame, the ref is updated
 * only when the store changes via subscription.
 *
 * Usage:
 * ```typescript
 * const { stateRef, unsubscribe } = createStoreRef(
 *   useAppearanceStore,
 *   (state) => state.appearanceVersion
 * )
 *
 * // In useFrame:
 * const version = stateRef.current // No getState() call
 *
 * // On unmount:
 * unsubscribe()
 * ```
 *
 * @param store - Zustand store hook
 * @param selector - Selector function
 * @returns Subscription with ref and cleanup
 */
export function createStoreRef<TStore, TSelected>(
  store: {
    getState: () => TStore
    subscribe: (listener: (state: TStore) => void) => () => void
  },
  selector: (state: TStore) => TSelected
): StoreSubscription<TSelected> {
  // Create ref with initial value
  const stateRef = {
    current: selector(store.getState()),
  }

  // Subscribe to updates
  const unsubscribe = store.subscribe((state) => {
    stateRef.current = selector(state)
  })

  return { stateRef, unsubscribe }
}

/**
 * Create multiple subscription refs at once.
 *
 * @param store - Zustand store hook
 * @param selectors - Object mapping names to selectors
 * @returns Object with refs and single unsubscribe
 */
export function createStoreRefs<TStore, TSelectors extends Record<string, (state: TStore) => unknown>>(
  store: {
    getState: () => TStore
    subscribe: (listener: (state: TStore) => void) => () => void
  },
  selectors: TSelectors
): {
  refs: { [K in keyof TSelectors]: MutableRefObject<ReturnType<TSelectors[K]>> }
  unsubscribe: () => void
} {
  type Refs = { [K in keyof TSelectors]: MutableRefObject<ReturnType<TSelectors[K]>> }

  const state = store.getState()

  // Create refs for all selectors
  const refs = {} as Refs
  for (const key in selectors) {
    const selector = selectors[key]
    if (selector) {
      refs[key] = {
        current: selector(state) as ReturnType<TSelectors[typeof key]>,
      }
    }
  }

  // Single subscription updates all refs
  const unsubscribe = store.subscribe((newState) => {
    for (const key in selectors) {
      const selector = selectors[key]
      if (selector) {
        refs[key].current = selector(newState) as ReturnType<TSelectors[typeof key]>
      }
    }
  })

  return { refs, unsubscribe }
}

/**
 * React hook version of createStoreRef.
 *
 * Usage:
 * ```typescript
 * const stateRef = useStoreRef(useAppearanceStore, (s) => s.faceColor)
 *
 * useFrame(() => {
 *   const faceColor = stateRef.current // No getState() call
 * })
 * ```
 */
export function useStoreRefSetup<TStore, TSelected>(
  store: {
    getState: () => TStore
    subscribe: (listener: (state: TStore) => void) => () => void
  },
  selector: (state: TStore) => TSelected,
  useEffect: (effect: () => (() => void) | void, deps?: unknown[]) => void,
  useRef: <T>(initial: T) => MutableRefObject<T>
): MutableRefObject<TSelected> {
  const stateRef = useRef(selector(store.getState()))

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      stateRef.current = selector(state)
    })
    return unsubscribe
  }, [store, selector])

  return stateRef
}
