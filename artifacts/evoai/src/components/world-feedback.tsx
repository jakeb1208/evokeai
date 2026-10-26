import { useState, type FormEvent } from 'react';
import { saveWorldFeedback } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export type WorldFeedbackRatings = {
  happiness: number;
  good_memories: number;
  visual_memories: number;
  music_memories: number;
  return_interest: number;
};
export type WorldFeedbackValue = WorldFeedbackRatings & { average: number };

const questions = [
  ['happiness', 'Did the experience make you feel happy overall?'],
  ['good_memories', 'Did this make you recall good memories?'],
  ['visual_memories', 'Did the visual experience evoke memories?'],
  ['music_memories', 'Did the music evoke memories?'],
  ['return_interest', 'Would you do this again?'],
] as const;

type RatingKey = (typeof questions)[number][0];

export function WorldFeedbackDialog({
  worldId,
  worldName,
  initial,
  accessToken,
  onSaved,
  onClose,
}: {
  worldId: string;
  worldName: string;
  initial: WorldFeedbackValue | null;
  accessToken: string;
  onSaved: (feedback: WorldFeedbackValue) => void;
  onClose: () => void;
}) {
  const [ratings, setRatings] = useState<Partial<WorldFeedbackRatings>>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (questions.some(([key]) => !ratings[key]) || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await saveWorldFeedback(worldId, ratings as WorldFeedbackRatings, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onSaved(result.feedback);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your ratings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="world-feedback-dialog">
        <DialogTitle>Feedback for {worldName}</DialogTitle>
        <DialogDescription>
          Rate each question from 1 to 3 stars. Your ratings are private to your account and can be changed at any time.
        </DialogDescription>
        <form onSubmit={(event) => void submit(event)}>
          {questions.map(([key, question]) => (
            <fieldset className="world-feedback-question" key={key} disabled={saving}>
              <legend>{question}</legend>
              <div className="world-feedback-stars">
                {([1, 2, 3] as const).map((rating) => (
                  <label key={rating}>
                    <input
                      type="radio"
                      name={key}
                      value={rating}
                      checked={ratings[key] === rating}
                      onChange={() => setRatings((current) => ({ ...current, [key]: rating }))}
                    />
                    <span aria-hidden="true">{'★'.repeat(rating)}</span>
                    <span className="sr-only">{rating} {rating === 1 ? 'star' : 'stars'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {error ? <p className="studio-error" role="alert">{error}</p> : null}
          <div className="world-feedback-actions">
            <button type="button" disabled={saving} onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving || questions.some(([key]) => !ratings[key])}>
              {saving ? 'Saving…' : 'Save feedback'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
