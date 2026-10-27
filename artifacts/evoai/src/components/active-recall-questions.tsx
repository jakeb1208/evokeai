import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const questions = [
  'Does this place bring to mind a particular event or moment in your life?',
  'Are there any sounds or smells you remember from a place like this?',
  'Does this place remind you of a particular time or period in your life?',
  'Does anyone come to mind, and what do you remember doing together?',
  'Are there any familiar objects or everyday routines you remember?',
];

export function ActiveRecallQuestions() {
  return (
    <div className="active-recall">
      <Dialog>
        <DialogTrigger asChild>
          <button className="evoke-button evoke-button-small" type="button">
            Active recall questions
          </button>
        </DialogTrigger>
        <DialogContent className="world-feedback-dialog active-recall-dialog">
          <DialogTitle>Active recall questions</DialogTitle>
          <DialogDescription>
            Take your time with any question you like. It’s okay if nothing comes to mind;
            you can skip a question or stop at any time. There are no right or wrong answers.
          </DialogDescription>
          <ol className="active-recall-questions">
            {questions.map((question) => <li key={question}>{question}</li>)}
          </ol>
          <p className="active-recall-note">
            These are optional conversation prompts, not a memory test. No answers are recorded.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
