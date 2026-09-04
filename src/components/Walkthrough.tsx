import { useEffect } from "react";
import "./Walkthrough.css";

interface WalkthroughProps {
  step: number | null;
  onSkip: () => void;
  onFinish: () => void;
  onRestart: () => void;
}

const steps = [
  {
    title: "Start with a book",
    body: "This map groups books by readers who enjoyed similar titles. Click any green book node to begin.",
    hint: "Click a green node",
    focus: "map",
  },
  {
    title: "Follow a recommendation",
    body: "The connecting lines lead to related books. Click any visible line to travel to its recommendation.",
    hint: "Click a connecting line",
    focus: "edge",
  },
  {
    title: "Look around",
    body: "Zoom in to inspect a neighborhood or zoom out to see the wider landscape.",
    hint: "Use +, −, your mouse wheel, or pinch",
    focus: "zoom",
  },
  {
    title: "Choose the new book",
    body: "The camera moved without changing your selection. Click the book node here to select it and reveal its recommendations.",
    hint: "Click the node at the new location",
    focus: "node",
  },
  {
    title: "Find something specific",
    body: "Search by title, including small misspellings, or use Filters to narrow results by author and publication year.",
    hint: "You are ready to explore",
    focus: "search",
  },
];

export default function Walkthrough({
  step,
  onSkip,
  onFinish,
  onRestart,
}: WalkthroughProps) {
  useEffect(() => {
    if (step === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [step, onSkip]);

  if (step === null) {
    return (
      <button
        type="button"
        className="walkthrough-restart"
        onClick={onRestart}
        aria-label="Show website walkthrough"
        title="Show walkthrough"
      >
        ?
      </button>
    );
  }

  const currentStep = steps[step];

  return (
    <div
      className={`walkthrough walkthrough-${currentStep.focus}`}
      aria-live="polite"
    >
      <div className="walkthrough-dim" />
      <div className="walkthrough-focus-ring" aria-hidden="true" />

      <section
        className="walkthrough-card"
        role="dialog"
        aria-modal="false"
        aria-label={`Walkthrough step ${step + 1}: ${currentStep.title}`}
      >
        <div className="walkthrough-progress">
          <span>
            {step + 1} of {steps.length}
          </span>
          <div className="walkthrough-dots" aria-hidden="true">
            {steps.map((_, index) => (
              <span
                key={index}
                className={index === step ? "active" : ""}
              />
            ))}
          </div>
        </div>

        <h2>{currentStep.title}</h2>
        <p>{currentStep.body}</p>
        <div className="walkthrough-hint">{currentStep.hint}</div>

        <div className="walkthrough-actions">
          <button
            type="button"
            className="walkthrough-skip"
            onClick={onSkip}
          >
            Skip tour
          </button>

          {step === steps.length - 1 && (
            <>
              <a
                href="https://github.com/narengogi/map-of-goodreads"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub ⭐
              </a>
              <button
                type="button"
                className="walkthrough-finish"
                onClick={onFinish}
              >
                Start exploring
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
