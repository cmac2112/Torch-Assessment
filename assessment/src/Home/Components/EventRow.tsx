import type { KeyboardEvent } from "react";
import { type RowComponentProps } from "react-window";
import type { EventRowData } from "../Types/types";
import { useEventModal } from "../Hooks/useEventModal";
import "../Home.css"
import { formatConfidence, formatTimestamp } from "../Shared/Formatting";

const EventRow = ({ index, style, ariaAttributes, rows }: RowComponentProps<EventRowData>) => {
  const { openEvent } = useEventModal();
  const item = rows.get(index);

  if (!item) {
    return (
      <div style={style} {...ariaAttributes} className="event-row">
        <div className="event-card event-card-skeleton" aria-hidden="true" />
      </div>
    );
  }

  const confidence = formatConfidence(item.confidence);
  const id = String(item.id);

  const handleOpen = () => openEvent(id);
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openEvent(id);
    }
  };



  return (
    <div style={style} {...ariaAttributes} className="event-row">
      <div
        className="event-card"
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-label={`View details for event ${id}`}
      >
        <div className="event-card-header">
          <span className="event-badge" style={{color:`var(--badge-${item.type ?? "unknown"})`}}>{String(item.type ?? "unknown")}</span>
          <span className="event-id">{String(item.id)}</span>
          <span className="event-time">{formatTimestamp(item.timestamp)}</span>
        </div>

        {item.description ? (
          <p className="event-description">{String(item.description)}</p>
        ) : null}

        <div className="event-meta">
          <span>
            <strong>Location:</strong> {item.location ? String(item.location) : "—"}
          </span>
          <span className="confidence-bar">
            <strong>Confidence:</strong>
            {confidence !== null ? (
              <>
                <span className="confidence-track">
                  <span
                    className="confidence-fill"
                    style={{ width: `${Math.min(100, Math.max(0, confidence * 100))}%` }}
                  />
                </span>
                {Math.round(confidence * 100)}%
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
export default EventRow;