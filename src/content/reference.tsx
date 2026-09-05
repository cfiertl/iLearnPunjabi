import { isValidElement, type ReactNode } from "react";
import { FRAME_TAGS } from "@/lib/frame-tags";

// In-app reference. Static text, read-only, no state, and nothing here drives
// app behaviour — the one functional coupling is the cloze card back linking a
// frameTag into the `frames` section.
//
// Authored as components rather than markdown: the content is a fixed constant,
// so a runtime markdown parser would add a dependency and ~40KB of client JS to
// render text we already control. Tables, emphasis and code render natively.

export type ReferenceSection = {
  id: string;
  title: string;
  order: number;
  body: ReactNode;
};

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const TABLE = "w-full min-w-[22rem] border-collapse text-left text-sm";
const TH =
  "border-b border-border py-2 pr-3 text-xs font-medium uppercase tracking-wide text-muted";
const TD = "border-b border-border/60 py-2 pr-3 align-top";

/** Wide content scrolls inside its own box; the page never scrolls sideways. */
function Scroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted">{children}</p>;
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-brand-strong">
      {children}
    </code>
  );
}

function List({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted">
      {children}
    </ul>
  );
}

/**
 * Plain text of a section, for substring search.
 *
 * Walks the rendered tree rather than keeping a hand-written copy alongside,
 * so the search index cannot drift from what is on screen. This is why the
 * tables below are written as literal JSX: text has to live in `children`,
 * not in props, to be reachable from here.
 */
export function sectionText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(sectionText).join(" ");
  if (isValidElement(node)) {
    return sectionText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const routine: ReferenceSection = {
  id: "routine",
  order: 1,
  title: "Daily routine",
  body: (
    <div className="flex flex-col gap-4">
      <Scroll>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>When</th>
              <th className={TH}>Minutes</th>
              <th className={TH}>What</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>Morning</td>
              <td className={TD}>10</td>
              <td className={TD}>Due reviews</td>
            </tr>
            <tr>
              <td className={TD}>Commute</td>
              <td className={TD}>10–15</td>
              <td className={TD}>
                SBS clip — <B>same clip all week</B>
              </td>
            </tr>
            <tr>
              <td className={TD}>Throughout</td>
              <td className={TD}>—</td>
              <td className={TD}>Jasmine domains</td>
            </tr>
            <tr>
              <td className={TD}>Evening</td>
              <td className={TD}>5</td>
              <td className={TD}>
                Remaining reviews, log today&apos;s freezes
              </td>
            </tr>
            <tr>
              <td className={TD}>Mon/Wed/Fri</td>
              <td className={TD}>20</td>
              <td className={TD}>
                Gurmukhi recognition (weeks 1–6 only)
              </td>
            </tr>
          </tbody>
        </table>
      </Scroll>
      <P>
        The morning ten minutes is the one that cannot slip. Everything else
        can.
      </P>
      <P>
        On SBS: one clip, repeated all week. First pass is exposure. By the
        fourth you should manage roughly what it was about. Do not aim to
        understand it — twenty percent by Friday is the right trajectory.
      </P>
    </div>
  ),
};

const sessions: ReferenceSection = {
  id: "sessions",
  order: 2,
  title: "Sessions — what to bring",
  body: (
    <div className="flex flex-col gap-4">
      <P>Wednesday plus one weekend day.</P>
      <P>
        <B>Bring two things: the export, and the freeze list.</B>
      </P>
      <Scroll>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Portion</th>
              <th className={TH}>What</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>~10 min</td>
              <td className={TD}>Export review — which frames are not landing</td>
            </tr>
            <tr>
              <td className={TD}>~20 min</td>
              <td className={TD}>Teaching the next frame</td>
            </tr>
            <tr>
              <td className={TD}>~15 min</td>
              <td className={TD}>Freeze triage</td>
            </tr>
            <tr>
              <td className={TD}>~15 min</td>
              <td className={TD}>Production under pressure</td>
            </tr>
          </tbody>
        </table>
      </Scroll>
      <P>
        The export sets the first ten minutes. It does not set the session.
        Cards only test what is already taught, alone and unpressured, which is
        the easiest condition and not the one that is failing you.
      </P>
      <P>
        <B>Bring freezes unsolved.</B> A freeze you have already looked up tells
        us nothing about what you would have done in the moment.
      </P>
    </div>
  ),
};

const usingExport: ReferenceSection = {
  id: "export",
  order: 3,
  title: "Using the export",
  body: (
    <div className="flex flex-col gap-4">
      <P>Export before each session and paste it into the conversation.</P>
      <P>What gets read out of it:</P>
      <List>
        <li>
          <B>Agreement-fail rate over time.</B> The headline number. Is it
          moving?
        </li>
        <li>
          <B>Worst frame by tag</B> — and whether it is worst because it is{" "}
          <em>untaught</em> or <em>undrilled</em>. Different fixes.
        </li>
        <li>
          <B>Cards at 4+ agreement fails.</B> These get pulled and re-taught,
          not re-drilled.
        </li>
        <li>
          <B>Box distribution</B>, only if something looks stuck.
        </li>
      </List>
      <P>
        The middle grade — <em>right words, wrong agreement</em> — is the
        instrument. If you round it down to &ldquo;wrong&rdquo; or up to
        &ldquo;got it&rdquo;, the export stops being able to tell whether the
        actual problem is shrinking.
      </P>
    </div>
  ),
};

const freezes: ReferenceSection = {
  id: "freezes",
  order: 4,
  title: "The freeze pipeline",
  body: (
    <div className="flex flex-col gap-4">
      <P>
        <B>Capture.</B> English only, ten seconds, in the moment. Do not look it
        up, do not ask Jasmine. Looking it up feels productive and destroys the
        data — the value is the pattern across twenty freezes, not solving any
        one of them.
      </P>
      <P>
        <B>Triage weekly into three buckets:</B>
      </P>
      <List>
        <li>
          <B>A — missing a word.</B> Structure was there, vocabulary was not.
          Get it from Jasmine. Becomes a card only if it fits a taught frame.
        </li>
        <li>
          <B>B — missing a frame.</B> Words there, no idea how to assemble them.
          Never a card. Goes to the session and sets curriculum order.
        </li>
        <li>
          <B>C — had it, froze anyway.</B> Everything known, mouth would not
          move. Straight into the deck plus spoken repetition.
        </li>
      </List>
      <P>
        <B>B means teach. C means drill.</B> Treating a B as a C produces
        frustration. Treating a C as a B produces a growing pile of knowledge
        you cannot deploy.
      </P>
      <P>
        <B>Generalise before carding.</B> One freeze becomes two or three cards,
        never one. Vary exactly one element per card — person, gender, object,
        tense — never two, or you cannot tell which one you got wrong.
      </P>
      <P>
        <B>Cap: ten new cards per week from freezes.</B> Thirty candidates means
        take ten and bin the rest. They resurface if they matter.
      </P>
    </div>
  ),
};

const frames: ReferenceSection = {
  id: "frames",
  order: 5,
  title: "Frame reference",
  body: (
    <div className="flex flex-col gap-4">
      <Scroll>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Tag</th>
              <th className={TH}>Rule</th>
            </tr>
          </thead>
          <tbody>
            {/* Rendered from FRAME_TAGS so the rules here and the ones on card
                backs cannot drift apart. Row ids are the cloze deep-link targets. */}
            {Object.entries(FRAME_TAGS).map(([tag, entry]) => (
              <tr key={tag} id={tag} className="scroll-mt-24 target:bg-brand/10">
                <td className={TD}>
                  <Code>{tag}</Code>
                </td>
                <td className={TD}>{entry.long}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      <P>
        Standing error: sending every verb back to &ldquo;I&rdquo;. Four of
        these eight are cases where it agrees with something else.
      </P>
    </div>
  ),
};

const sequence: ReferenceSection = {
  id: "sequence",
  order: 6,
  title: "Frame sequence",
  body: (
    <div className="flex flex-col gap-4">
      <P>
        Cards exist only for frames already taught. This is what stops the deck
        becoming a pile of sentences you can recite but not generalise.
      </P>
      <Scroll>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Week</th>
              <th className={TH}>Frame</th>
              <th className={TH}>Batch</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>1–2</td>
              <td className={TD}>Dative subject + copula agreement</td>
              <td className={TD}>1 (cards 1–28)</td>
            </tr>
            <tr>
              <td className={TD}>3</td>
              <td className={TD}>
                Genitive <Code>da / di / de</Code>
              </td>
              <td className={TD}>1 (cards 29–35)</td>
            </tr>
            <tr>
              <td className={TD}>4</td>
              <td className={TD}>Negation + continuous agreement</td>
              <td className={TD}>1 (cards 36–48)</td>
            </tr>
            <tr>
              <td className={TD}>5–6</td>
              <td className={TD}>Perfective past and object agreement</td>
              <td className={TD}>2</td>
            </tr>
            <tr>
              <td className={TD}>7</td>
              <td className={TD}>
                Future <Code>-anga / -angi</Code>
              </td>
              <td className={TD}>3</td>
            </tr>
            <tr>
              <td className={TD}>8</td>
              <td className={TD}>Polite imperative and register</td>
              <td className={TD}>3</td>
            </tr>
            <tr>
              <td className={TD}>9+</td>
              <td className={TD}>Caregiver corpus</td>
              <td className={TD}>4</td>
            </tr>
          </tbody>
        </table>
      </Scroll>
      <P>
        Sequence moves if the freeze list demands it. Four freezes needing the
        future pulls the future forward.
      </P>
    </div>
  ),
};

const cardRules: ReferenceSection = {
  id: "cards",
  order: 7,
  title: "Card rules",
  body: (
    <div className="flex flex-col gap-4">
      <List>
        <li>Sentences, never single words. Vocabulary is not the problem.</li>
        <li>Say it aloud in full before flipping. Every time.</li>
        <li>
          Three grades: <B>Got it</B> / <B>Right words, wrong agreement</B> /{" "}
          <B>Couldn&apos;t produce it</B>.
        </li>
        <li>
          Four agreement fails on one card means it gets{" "}
          <B>re-taught, not re-drilled</B>.
        </li>
        <li>Ten new cards a day, maximum.</li>
      </List>
      <P>
        Deck size is the enemy. A hundred cards reviewed daily beats four
        hundred reviewed occasionally, and the second is what happens without a
        cap.
      </P>
    </div>
  ),
};

const jasmine: ReferenceSection = {
  id: "jasmine",
  order: 8,
  title: "Jasmine protocol",
  body: (
    <List>
      <li>
        <B>Domains, not time slots.</B> Specific situations are always Punjabi
        regardless of duration. Currently the kitchen, and the first five
        minutes after you get home. Add one every three to four weeks.
      </li>
      <li>
        <B>Repair ladder.</B> When you do not understand: repeat slower → repeat
        simpler → gesture → <em>then</em> English. Rung two usually suffices,
        and that is where the learning is.
      </li>
      <li>
        <B>No live correction</B>, except pronunciation of a word she just said.
        Errors go to the log, not into the conversation.
      </li>
      <li>
        <B>She is the authority.</B> Where standard Punjabi and her family
        diverge, her family wins. Log the divergence.
      </li>
    </List>
  ),
};

const checkpoint: ReferenceSection = {
  id: "checkpoint",
  order: 9,
  title: "Weekly checkpoint",
  body: (
    <div className="flex flex-col gap-4">
      <P>Five minutes at the end of the weekend session:</P>
      <List>
        <li>Export sent</li>
        <li>Agreement-fail rate — moving?</li>
        <li>Worst frame — untaught or undrilled?</li>
        <li>Cards at 4+ agreement fails pulled for re-teaching</li>
        <li>New domain due? (every 3–4 weeks)</li>
        <li>Family register corrections logged</li>
      </List>
      <P>
        <B>Week 8 target.</B> Not fluency. Agreement-fail rate under 20% on
        taught frames; five dative pronouns automatic; you reach for{" "}
        <Code>mainu samajh nahi aayi</Code> instead of switching to English;
        kitchen domain holds; reading Gurmukhi slowly without transliterating in
        your head; freeze list shifting from bucket B toward C.
      </P>
    </div>
  ),
};

export const REFERENCE_SECTIONS: ReferenceSection[] = [
  routine,
  sessions,
  usingExport,
  freezes,
  frames,
  sequence,
  cardRules,
  jasmine,
  checkpoint,
].sort((a, b) => a.order - b.order);

export function findSection(id: string): ReferenceSection | undefined {
  return REFERENCE_SECTIONS.find((s) => s.id === id);
}
