import { useEffect, useMemo, useRef, useState } from "react";
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

function pickHighestPriority(candidates: BannerCandidate[]): BannerCandidate | null {
  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  for (const candidate of candidates) {
    if (candidate.priority > best.priority) best = candidate;
  }
  return best;
}

function toResolvedBanner(previous: BannerDisplay): BannerDisplay {
  const message =
    previous.source === "grid"
      ? "Grid issues resolved."
      : "Issue resolved.";

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

  const shownAtMsRef = useRef<number>(0);
  const maybeHideTimerIdRef = useRef<number | null>(null);
  const maybeResolvedTimerIdRef = useRef<number | null>(null);

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

  useEffect(() => {
    // SHOW POLICY: show immediately when a candidate appears.
    if (selected) {
      clearTimers();

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
      return;
    }

    // HIDE POLICY: only hide after it's been stable OK for hideDelayMs,
    // and after the banner has been visible for at least minVisibleMs.
    if (!isVisible || maybeDisplayedBanner === null) return;

    clearTimers();

    const nowMs = Date.now();
    const earliestHideMs = shownAtMsRef.current + minVisibleMs;
    const hideAtMs = Math.max(nowMs + hideDelayMs, earliestHideMs);
    const delayMs = Math.max(0, hideAtMs - nowMs);

    maybeHideTimerIdRef.current = window.setTimeout(() => {
      // "Resolved" feedback without reflow.
      setMaybeDisplayedBanner(toResolvedBanner(maybeDisplayedBanner));
      setIsVisible(true);

      maybeResolvedTimerIdRef.current = window.setTimeout(() => {
        setIsVisible(false);
        setMaybeDisplayedBanner(null);
      }, resolvedVisibleMs);
    }, delayMs);
  }, [
    hideDelayMs,
    isVisible,
    maybeDisplayedBanner,
    minVisibleMs,
    resolvedVisibleMs,
    selected,
  ]);

  const slotStyle = useMemo(
    () => ({ minHeight: `${reserveMinHeightPx}px` }),
    [reserveMinHeightPx],
  );

  return (
    <div className={cn("w-full", className)} style={slotStyle}>
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
        ) : (
          // Keep the slot stable even when empty.
          <div className="h-[1px]" />
        )}
      </div>
    </div>
  );
}

