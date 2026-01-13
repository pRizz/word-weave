import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type BannerVariant = "default" | "destructive";

export type BannerSource = "generation" | "grid";

export type BannerCandidate = Readonly<{
  /**
   * Stable identifier for "replace policy":
   * - If the same source continues to be selected but the content changes, we replace in-place
   *   without exit/enter churn.
   */
  source: BannerSource;
  /**
   * Higher wins.
   */
  priority: number;
  variant: BannerVariant;
  title: string;
  message: string;
  details?: string[];
}>;

type BannerDisplayMode = "normal" | "resolved";

type BannerDisplay = Readonly<{
  mode: BannerDisplayMode;
  variant: BannerVariant;
  title: string;
  message: string;
  details?: string[];
  source: BannerSource;
}>;

export type BannerHostProps = Readonly<{
  candidates: BannerCandidate[];
  className?: string;
  /**
   * How long to keep a banner visible after it first appears,
   * even if the underlying state resolves immediately.
   */
  minVisibleMs?: number;
  /**
   * How long the underlying state must remain clear before we switch to "Resolved".
   */
  hideDelayMs?: number;
  /**
   * How long to display the "Resolved" banner before hiding.
   */
  resolvedVisibleMs?: number;
  /**
   * Reserve layout space for the banner slot to avoid reflow/jitter.
   */
  reserveMinHeightPx?: number;
}>;

function pickHighestPriority(
  candidates: BannerCandidate[],
): BannerCandidate | null {
  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  for (const candidate of candidates) {
    if (candidate.priority > best.priority) best = candidate;
  }
  return best;
}

function toResolvedBanner(previous: BannerDisplay): BannerDisplay {
  const message =
    previous.source === "grid" ? "Grid issues resolved." : "Issue resolved.";

  return {
    mode: "resolved",
    source: previous.source,
    variant: "default",
    title: "Resolved",
    message,
  };
}

function IconForBanner({
  variant,
  mode,
}: {
  variant: BannerVariant;
  mode: BannerDisplayMode;
}) {
  if (mode === "resolved") return <CheckCircle2 className="h-4 w-4" />;
  if (variant === "destructive") return <AlertCircle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function BannerHost({
  candidates,
  className,
  minVisibleMs = 900,
  hideDelayMs = 450,
  resolvedVisibleMs = 900,
  reserveMinHeightPx = 72,
}: BannerHostProps) {
  const selected = useMemo(() => pickHighestPriority(candidates), [candidates]);

  const [isVisible, setIsVisible] = useState(false);
  const [maybeDisplayedBanner, setMaybeDisplayedBanner] =
    useState<BannerDisplay | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [maybePreviousHeight, setMaybePreviousHeight] = useState<number | null>(
    null,
  );

  const shownAtMsRef = useRef<number>(0);
  const maybeHideTimerIdRef = useRef<number | null>(null);
  const maybeResolvedTimerIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingHeightTransitionRef = useRef<{
    fromHeight: number;
    toHeight: number | null;
  } | null>(null);

  const clearTimers = () => {
    const maybeHideTimerId = maybeHideTimerIdRef.current;
    if (maybeHideTimerId !== null) {
      window.clearTimeout(maybeHideTimerId);
      maybeHideTimerIdRef.current = null;
    }

    const maybeResolvedTimerId = maybeResolvedTimerIdRef.current;
    if (maybeResolvedTimerId !== null) {
      window.clearTimeout(maybeResolvedTimerId);
      maybeResolvedTimerIdRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      const maybeHideTimerId = maybeHideTimerIdRef.current;
      if (maybeHideTimerId !== null) {
        window.clearTimeout(maybeHideTimerId);
        maybeHideTimerIdRef.current = null;
      }

      const maybeResolvedTimerId = maybeResolvedTimerIdRef.current;
      if (maybeResolvedTimerId !== null) {
        window.clearTimeout(maybeResolvedTimerId);
        maybeResolvedTimerIdRef.current = null;
      }
    };
  }, []);

  // Track the previous selected to detect changes
  const prevSelectedRef = useRef<BannerCandidate | null>(null);

  useEffect(() => {
    const prevSelected = prevSelectedRef.current;
    prevSelectedRef.current = selected;

    // SHOW POLICY: show immediately when a candidate appears.
    if (selected) {
      clearTimers();

      // Only update if the selected candidate actually changed
      const hasChanged =
        !prevSelected ||
        prevSelected.source !== selected.source ||
        prevSelected.priority !== selected.priority ||
        prevSelected.title !== selected.title ||
        prevSelected.message !== selected.message ||
        JSON.stringify(prevSelected.details) !==
          JSON.stringify(selected.details);

      if (hasChanged) {
        const nextDisplay: BannerDisplay = {
          mode: "normal",
          source: selected.source,
          variant: selected.variant,
          title: selected.title,
          message: selected.message,
          details: selected.details,
        };

        // If we were hidden, start the visible window now.
        if (!isVisible) {
          shownAtMsRef.current = Date.now();
        }

        // REPLACE POLICY: update in place (no hide/re-show) when selected changes.
        setMaybeDisplayedBanner(nextDisplay);
        setIsVisible(true);
      }
      return;
    }

    // HIDE POLICY: only hide after it's been stable OK for hideDelayMs,
    // and after the banner has been visible for at least minVisibleMs.
    // Only proceed if we were showing a banner and now there's no selected candidate.
    if (!prevSelected || !isVisible) return;

    clearTimers();

    const nowMs = Date.now();
    const earliestHideMs = shownAtMsRef.current + minVisibleMs;
    const hideAtMs = Math.max(nowMs + hideDelayMs, earliestHideMs);
    const delayMs = Math.max(0, hideAtMs - nowMs);

    // Use a ref to access the current displayed banner to avoid dependency issues
    maybeHideTimerIdRef.current = window.setTimeout(() => {
      // Capture current height before transition
      const previousHeight = containerRef.current?.scrollHeight ?? null;
      if (previousHeight === null) {
        // If we can't measure, just proceed without smooth transition
        setMaybeDisplayedBanner((currentBanner) => {
          if (currentBanner === null) return null;
          return toResolvedBanner(currentBanner);
        });
        setIsVisible(true);
        return;
      }

      // Set transition state and lock to previous height
      setMaybePreviousHeight(previousHeight);
      setIsTransitioning(true);

      // Change content while locked at previous height
      setMaybeDisplayedBanner((currentBanner) => {
        if (currentBanner === null) return null;
        return toResolvedBanner(currentBanner);
      });
      setIsVisible(true);

      // Store transition info for useLayoutEffect to handle
      pendingHeightTransitionRef.current = {
        fromHeight: previousHeight,
        toHeight: null, // Will be measured in useLayoutEffect
      };

      maybeResolvedTimerIdRef.current = window.setTimeout(() => {
        // Start collapse animation
        setIsVisible(false);
        // Wait for collapse animation to complete before removing content
        setTimeout(() => {
          setMaybeDisplayedBanner(null);
        }, 250); // Match the transition duration
      }, resolvedVisibleMs);
    }, delayMs);
  }, [hideDelayMs, isVisible, minVisibleMs, resolvedVisibleMs, selected]);

  // Handle height transitions after DOM updates
  useLayoutEffect(() => {
    const pending = pendingHeightTransitionRef.current;
    if (!pending) return;

    // Measure new height after content has rendered
    const newHeight = containerRef.current?.scrollHeight ?? null;

    if (newHeight !== null && newHeight !== pending.fromHeight) {
      // Store the new height in the ref for the transition
      pendingHeightTransitionRef.current = {
        ...pending,
        toHeight: newHeight,
      };

      // Force a reflow to ensure the old height is applied and painted
      void containerRef.current?.offsetHeight;

      // Use requestAnimationFrame to wait for the next paint cycle
      // This ensures the browser has painted the old height before we change it
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Now update to new height - CSS transition will animate the change
          setMaybePreviousHeight(newHeight);
          // After animation completes, allow natural sizing
          setTimeout(() => {
            setIsTransitioning(false);
            setMaybePreviousHeight(null);
            pendingHeightTransitionRef.current = null;
          }, 250); // Match transition duration
        });
      });
    } else {
      // Heights are the same or measurement failed, just clear transition
      setIsTransitioning(false);
      setMaybePreviousHeight(null);
      pendingHeightTransitionRef.current = null;
    }
  }, [maybeDisplayedBanner]); // Re-run when banner content changes

  const slotStyle = useMemo(
    () => ({ minHeight: `${reserveMinHeightPx}px` }),
    [reserveMinHeightPx],
  );

  // Determine if we should show the container (either visible or collapsing)
  const shouldShowContainer = maybeDisplayedBanner !== null;

  // During transitions, use fixed height to prevent jitter; otherwise use max-height
  const containerStyle: React.CSSProperties = {
    ...slotStyle,
    transition: "max-height 250ms ease-out, height 250ms ease-out",
    overflow: "hidden",
  };

  if (shouldShowContainer) {
    if (isVisible) {
      if (isTransitioning && maybePreviousHeight !== null) {
        // During transition, always use fixed height for smooth animation
        containerStyle.height = `${maybePreviousHeight}px`;
        // Don't set maxHeight when using fixed height during transition
        delete containerStyle.maxHeight;
      } else {
        // Normal state: use max-height to allow natural sizing
        delete containerStyle.height;
        containerStyle.maxHeight = "300px";
      }
    } else {
      // Collapsing: animate to 0
      delete containerStyle.height;
      containerStyle.maxHeight = "0px";
    }
  } else {
    // Hidden: no height
    delete containerStyle.height;
    containerStyle.maxHeight = "0px";
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full overflow-hidden motion-reduce:transition-none",
        className,
      )}
      style={containerStyle}
    >
      <div
        className={cn(
          "will-change-[transform,opacity] transition-all duration-250 ease-out motion-reduce:transition-none",
          isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-2 scale-[0.985] pointer-events-none",
        )}
      >
        {maybeDisplayedBanner ? (
          <Alert
            variant={maybeDisplayedBanner.variant}
            className={cn(
              "shadow-soft",
              maybeDisplayedBanner.mode === "resolved" &&
                "bg-primary/5 border-primary/20 text-foreground",
            )}
          >
            <IconForBanner
              variant={maybeDisplayedBanner.variant}
              mode={maybeDisplayedBanner.mode}
            />
            <div>
              <AlertTitle className="font-sans">
                {maybeDisplayedBanner.title}
              </AlertTitle>
              <AlertDescription className="font-sans">
                <p>{maybeDisplayedBanner.message}</p>
                {maybeDisplayedBanner.details &&
                  maybeDisplayedBanner.details.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-sm text-muted-foreground">
                        Details
                      </summary>
                      <ul className="mt-2 space-y-1 text-sm">
                        {maybeDisplayedBanner.details.map((detail) => (
                          <li key={detail} className="text-muted-foreground">
                            - {detail}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
              </AlertDescription>
            </div>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
