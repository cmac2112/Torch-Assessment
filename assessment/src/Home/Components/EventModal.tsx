import { useEffect, useRef, useState } from "react";
import type { DetailResult } from "../../../api/mockApi";
import { getEvent, isAbort } from "../../../api/mockApi";
import { useEventModal } from "../Hooks/useEventModal";
import "../Home.css";
import { formatConfidence, formatTimestamp } from "../Shared/Formatting";
type ModalResult =
  | { id: string; status: "error"; error: string }
  | { id: string; status: "ready"; detail: DetailResult };

// only rendered by EventModalProvider once currentId is set
const EventModal = () => {
  const { stack, currentId, navigateTo, goToBreadcrumb, close } = useEventModal();
  const eventId = currentId as string;
  const [result, setResult] = useState<ModalResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const detail = await getEvent(eventId, controller.signal);
        setResult({ id: eventId, status: "ready", detail });
      } catch (err) {
        if (isAbort(err)) {
          return;
        } else {
          setResult({
            id: eventId,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    load();

    return () => controller.abort();
  }, [eventId, reloadKey]);

  // ignore a stale result left over from the previous eventId while the new fetch is in flight
  const state: ModalResult | { status: "loading" } =
    result && result.id === eventId ? result : { status: "loading" };

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const retry = () => setReloadKey((k) => k + 1);

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-text">
            {stack.length > 1 && (
              <nav className="modal-breadcrumbs" aria-label="Breadcrumb">
                {stack.map((id, i) => {
                  const isCurrent = i === stack.length - 1;
                  return (
                    <span key={`${id}-${i}`} className="modal-breadcrumb-item">
                      {i > 0 && <span className="modal-breadcrumb-sep">/</span>}
                      {isCurrent ? (
                        <span className="modal-breadcrumb-current">{id}</span>
                      ) : (
                        <button
                          type="button"
                          className="modal-breadcrumb-link"
                          onClick={() => goToBreadcrumb(i)}
                        >
                          {id}
                        </button>
                      )}
                    </span>
                  );
                })}
              </nav>
            )}
            <h2 id="event-modal-title" className="modal-title">
              {eventId}
            </h2>
          </div>
          <button ref={closeButtonRef} type="button" className="modal-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {state.status === "loading" && <p className="modal-status">Loading…</p>}

        {state.status === "error" && (
          <div className="modal-error">
            <p>Failed to load event: {state.error}</p>
            <button className="events-retry" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <dl className="modal-fields">
              <dt>Type</dt>
              <dd>{String(state.detail.event.type ?? "unknown")}</dd>

              <dt>Timestamp</dt>
              <dd>{formatTimestamp(state.detail.event.timestamp)}</dd>

              <dt>Location</dt>
              <dd>{state.detail.event.location ? String(state.detail.event.location) : "—"}</dd>

              <dt>Confidence</dt>
              <dd>{formatConfidence(state.detail.event.confidence)}</dd>

              {state.detail.event.description ? (
                <>
                  <dt>Description</dt>
                  <dd>{String(state.detail.event.description)}</dd>
                </>
              ) : null}

              {state.detail.event.sensor_id ? (
                <>
                  <dt>Sensor</dt>
                  <dd>{String(state.detail.event.sensor_id)}</dd>
                </>
              ) : null}

              {state.detail.event.classification ? (
                <>
                  <dt>Classification</dt>
                  <dd>{String(state.detail.event.classification)}</dd>
                </>
              ) : null}
            </dl>

            <div className="modal-related">
              <h3 className="modal-related-title">Related events</h3>
              {state.detail.related.length === 0 ? (
                <p className="modal-status">None</p>
              ) : (
                <ul className="modal-related-list">
                  {state.detail.related.map((link) => (
                    <li key={link.id}>
                      {link.self ? (
                        <span className="event-id">{link.id}</span>
                      ) : (
                        <button
                          type="button"
                          className="event-id modal-related-link"
                          onClick={() => navigateTo(link.id)}
                        >
                          {link.id}
                        </button>
                      )}
                      {link.self ? (
                        <span className="modal-related-tag">self</span>
                      ) : link.resolved ? (
                        <span className="modal-related-tag modal-related-tag-ok">resolved</span>
                      ) : (
                        <span className="modal-related-tag modal-related-tag-warn">dangling</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventModal;
