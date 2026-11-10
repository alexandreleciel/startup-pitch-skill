# Meetings: the run sheet, the follow-up, the objection log

What this file is for: running a 30-minute investor meeting, making the investor talk, following up within a day, and logging objections so they feed the appendix and the data room.
Read it when the founder asks for meeting preparation or has a meeting booked; reread section 2 after every meeting.
The questions and answers themselves live in `pitch/investor-qa.md` (written with `investor-questions.md`); tuning for an investor type is in `investor-types.md`.

## 1. The 30-minute meeting run sheet

Odds to keep in mind: roughly a 5 percent chance of investment after a first one-to-one, rising to a 25 to
60 percent offer rate out of the partner meeting at quoted firms (First Round, 2024). The first meeting's
job is therefore not to close; it is to harvest the real objections and earn the next meeting.

| Time | What happens | Notes |
|---|---|---|
| 0:00 to 0:05 | Warm-up; remind them in one sentence what the company does | They take many meetings a day; do not assume they remember the deck. |
| 0:05 to 0:07 | The two-minute founder story: how you came to this problem | Rehearsed, specific, with one number. Much of an early-stage decision is a read on the people. |
| 0:07 to 0:13 | The pitch, most impressive thing first: pain, product, progress, people | Deck on screen, a number in every sentence, three highest-signal facts land here. |
| 0:13 | The magic question (below) | Their answer is their real number-one concern. |
| 0:13 to 0:26 | Discussion | Aim for one third presenting, two thirds dialogue. Jump to the slide they care about. |
| 0:26 to 0:30 | Next steps, always | What happens next, what else they need, another meeting about what and when, any internal step and how long. Vague answers mean assume a no. |

Preparation: research the person (what they led, what they wrote) and the firm (portfolio competitor check,
stage, typical cheque); send the deck ahead so meeting one starts where meeting two would; rehearse a short
version that survives interruption and a long one that survives silence; pre-draft the follow-up email; have
the live demo loaded and a recorded fallback. Qualify them in the call: "Is the firm actively leading rounds
at this stage? What were the last three?"

### 1.1 The "make the investor talk" move

Investors convince themselves while talking; the more they talk, the more they talk themselves in
(Michael Seibel's point in the YC pitching guidance). Mechanics:
- At minute 13 ask the magic question: "Those are the highlights. What would you like to go deeper on:
  market, product, technology, team, customers?" Then go there and nowhere else until they are done.
- Answer short (`investor-questions.md` section 4) and stop. Silence is the invitation for their next question.
- Name the question behind the question: "I think you are asking whether this repeats outside my network.
  Is that right?" Then answer that.
- When they state a view, ask them to expand before you respond: "Say more about why." You learn the
  objection in their words, which is what the follow-up email mirrors.

### 1.2 Questions to ask the investor (pick five to eight)
- When you describe this to your partners, how will you describe it?
- What are the negatives your partners will raise first? What am I underestimating?
- What traction would make this an obvious yes?
- Have you seen someone try this and fail? What happened?
- What does your process look like from here, and what share of companies at your partner meeting get a term sheet?

## 2. Post-meeting: follow-up, objection log, appendix loop

### 2.1 Follow-up email skeleton (send within 24 hours, same day is better; no em dashes)

```
Subject: <Company>: follow-up and the <topic> data you asked for

Hi <Name>,

Thank you for the time today. You said the main question for you is <their exact phrasing of the concern>.

<Answer promised in the room, with the number, unit and date, and the attachment or link.>
<Second promised answer, if any.>

One new data point since we spoke: <fresh proof point with number and date>.

We are raising <amount> on <instrument>, closing <date>. <Dated ask: a second meeting on <date>,
an intro to <partner>, or a decision by <date>.>

<Founder name>
```

Mirror their phrasing of the concern word for word: it shows you listened and it tells you later whether
the concern moved. Keep follow-up deliverables in one folder and reuse them across investors asking the
same thing; a running FAQ compounds the same way.

### 2.2 The objection log

Log the meeting the same day, verbatim. Append to `pitch/objection-log.md` (create it on the first meeting):

```markdown
| Date | Investor (firm, role) | Verbatim objection or question | Theme (`question-bank.md` 1 to 11) | Ledger id or gap | Severity (1-3) | Times heard | Fix type | Status |
|---|---|---|---|---|---|---|---|---|
| 2026-11-12 | <firm>, partner | "Your three logos are all from your old employer." | 3 | mrr_current, gap#4 | 3 | 2 | appendix slide + pipeline export | in progress |
```

Fix types: better answer (edit `investor-qa.md`), appendix slide (add to `deck.json`), data-room item,
ledger change (a fact was wrong or missing), or company change (the objection is about reality, not the pitch).

Weekly review rules:
- Cluster by theme; separate frequency from severity.
- Change the pitch only after the same objection arrives two or three times, never after one.
- Different objections from different investors point to targeting or clarity problems: fix the artifact
  and keep going. The same objection from several well-matched investors is a fact about the company: stop
  pitching and go change the fact.
- Every new hard question becomes an appendix slide, so the in-room answer is crisp next time and investors
  who arrive late absorb weeks of Q&A at once. Rebuild the deck after the slide is added (`deck-structure.md`).
- Every promised item becomes a data-room entry with a status; answer data-room follow-ups within a day.
- Growth during the raise is the strongest counter to any objection; keep shipping and selling while raising.

### 2.3 Reading the signals

Questions and data-room opens are mild interest; reference and customer calls are serious; a partner-meeting
invitation is the big step. Weight the pipeline by behaviour, not enthusiasm. "Yes if you find a lead" is a no
until a lead exists. Never argue with a pass: ask what would change it, do exactly that, return with the update.
