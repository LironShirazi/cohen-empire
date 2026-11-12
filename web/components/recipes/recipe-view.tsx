"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useConfirm } from "@/components/ui/confirm";
import { startNavProgress } from "@/components/ui/navigation-progress";
import { RecipeImage, StepNumber, rb } from "@/components/recipes/rb";
import { createClient } from "@/lib/supabase/client";
import { RECIPE_LIMITS, servingsLabel } from "@/lib/recipes";
import { deleteRecipeFiles } from "@/lib/recipe-actions";
import type { RecipeDetail } from "@/lib/recipes-data";

/**
 * דף מתכון (7b) — סדר קבוע מלמעלה למטה: תמונה, שם, של מי (ובקטן —
 * מי הוסיף), מנות, רכיבים, שלבים ממוספרים, ובסוף שאלות.
 *
 * "כתב גדול" מגדיל את גוף המתכון מ-18 ל-22px — למי שמבשל עם הטלפון
 * על השיש ומתקשה לקרוא. הסימון של רכיבים הוא מקומי בלבד: הוא עוזר
 * בזמן הבישול ולא אמור להישמר לאף אחד אחר.
 */
export function RecipeView({
  recipe,
  addedLabel,
  canManage,
  userId,
  isOwner,
}: {
  recipe: RecipeDetail;
  /** "נוסף ע״י יעל · לפני שבוע" — מחושב בשרת, בלי hydration mismatch */
  addedLabel: string;
  /** מי שהוסיף את המתכון, או מנהל-על — עורך, עונה על שאלות ומוחק */
  canManage: boolean;
  /** הקורא — כדי לדעת על אילו שאלות להציג מחיקה */
  userId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [big, setBig] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    // `asked_by` לא נשלח — ברירת המחדל בטבלה היא `auth.uid()`
    const { error: insertError } = await createClient()
      .from("recipe_questions")
      .insert({ recipe_id: recipe.id, text });
    setBusy(false);
    if (insertError) return setError("השאלה לא נשלחה — ננסה שוב?");
    setDraft("");
    router.refresh();
  }

  async function remove() {
    const ok = await confirm({
      title: "מחיקת המתכון",
      message: `"${recipe.name}" יימחק מהספר, יחד עם התמונות והשאלות. אי אפשר לבטל.`,
      confirmLabel: "מחיקה",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    // קודם השורה, אחר-כך הקבצים (CLAUDE.md §10)
    const { error: deleteError } = await createClient()
      .from("recipes")
      .delete()
      .eq("id", recipe.id);
    if (deleteError) {
      setBusy(false);
      return setError("המחיקה נכשלה — ננסה שוב?");
    }
    await deleteRecipeFiles(recipe);
    startNavProgress("/recipes");
    router.push("/recipes");
    router.refresh();
  }

  return (
    <div className="flex-1">
      <div className="relative h-[250px] bg-rb-soft md:h-[340px]">
        <RecipePhotoStrip recipe={recipe} />
        <Link
          href="/recipes"
          aria-label="חזרה לספר המתכונים"
          className={`${rb.ic} absolute start-4 top-4 bg-white shadow-card`}
        >
          <Icon name="back" size={22} />
        </Link>
        {canManage ? (
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="absolute end-4 top-4 flex min-h-[46px] items-center gap-1.5 rounded-full bg-white px-4 text-[17px] font-bold text-rb-ink shadow-card"
          >
            <Icon name="edit" size={20} />
            עריכה
          </Link>
        ) : null}
      </div>

      <div className="px-5 pt-5 pb-9">
        <h1 className="text-[31px] leading-tight font-extrabold">{recipe.name}</h1>

        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 flex-none items-center justify-center rounded-full bg-granny text-[19px] font-extrabold text-rb-ink"
          >
            {recipe.owner_name.trim().charAt(0)}
          </span>
          <div className="leading-snug">
            <div className="text-[18px]">
              המתכון של <b>{recipe.owner_name}</b>
            </div>
            <div className={`text-[15px] ${rb.muted}`}>{addedLabel}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <span className="rounded-full bg-rb-green-soft px-4 py-2 text-[17px] font-bold text-rb-green-deep">
            כ-{servingsLabel(recipe.servings)}
          </span>
          <button
            type="button"
            aria-pressed={big}
            onClick={() => setBig((b) => !b)}
            className={`${rb.chip} ms-auto ${big ? rb.chipOn : rb.chipOff}`}
          >
            {big ? "כתב רגיל" : (
              <span className="flex items-center gap-1.5">
                <Icon name="search" size={18} />
                כתב גדול
              </span>
            )}
          </button>
        </div>

        <div style={{ fontSize: big ? 22 : 18, lineHeight: 1.6 }}>
          {recipe.ingredients.length > 0 ? (
            <>
              <h2 className={rb.section}>רכיבים</h2>
              <p className={`mb-1 text-[15px] ${rb.muted}`}>אפשר לסמן מה שכבר הכנתם</p>
              {recipe.ingredients.map((text, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-center gap-3.5 border-b border-rb-line py-2.5 has-checked:text-rb-muted has-checked:line-through"
                >
                  <input type="checkbox" className="size-[26px] flex-none accent-rb-green" />
                  <span>{text}</span>
                </label>
              ))}
            </>
          ) : null}

          <h2 className={rb.section}>אופן ההכנה</h2>
          {recipe.steps.map((step, i) => (
            <div key={i} className="flex gap-3.5 py-3">
              <StepNumber n={i + 1} />
              <div className="min-w-0 flex-1 whitespace-pre-line">
                {step.text}
                {step.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.image_url}
                    alt={`תמונה לשלב ${i + 1}`}
                    loading="lazy"
                    className="mt-2.5 max-h-[320px] w-full rounded-[14px] object-cover"
                  />
                ) : null}
              </div>
            </div>
          ))}

          <h2 className={rb.section}>שאלות על המתכון</h2>
          {recipe.questions.length === 0 ? (
            <p className={`text-[16px] ${rb.muted}`}>עוד אין שאלות. משהו לא ברור? שאלו כאן.</p>
          ) : (
            recipe.questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                canAnswer={canManage}
                canDelete={q.asked_by === userId || isOwner}
              />
            ))
          )}

          <form onSubmit={(e) => void ask(e)}>
            <label htmlFor="rc-q" className={`${rb.label} mt-4.5`}>
              יש לכם שאלה?
            </label>
            <input
              id="rc-q"
              className={rb.input}
              maxLength={RECIPE_LIMITS.question}
              placeholder="כתבו כאן את השאלה"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={busy || !draft.trim()} className={`${rb.btn2} mt-2.5 w-full`}>
              שליחת שאלה
            </button>
          </form>

          {error ? (
            <p role="alert" className="mt-3 rounded-[14px] bg-brand-soft px-4 py-2.5 text-[16px] font-bold text-brand">
              {error}
            </p>
          ) : null}

          {canManage ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 py-3 text-[16px] font-bold text-rb-muted disabled:opacity-45"
            >
              <Icon name="trash" size={18} />
              מחיקת המתכון
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * התמונות בראש הדף — הראשית ואחריה הנוספות (0026), בגלילה אופקית
 * עם הצמדה. תמונה אחת (או אף אחת) — בלי מונה ובלי גלילה, כמו קודם.
 */
function RecipePhotoStrip({ recipe }: { recipe: RecipeDetail }) {
  const urls = [recipe.photo_url, ...(recipe.extra_photo_urls ?? [])].filter(
    (u): u is string => !!u
  );
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (urls.length <= 1) {
    return (
      <RecipeImage url={urls[0] ?? null} alt={recipe.name} iconSize={110} className="h-full w-full" />
    );
  }

  return (
    <>
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          // ב-RTL ‏scrollLeft שלילי — הערך המוחלט הוא המרחק מהתמונה הראשונה
          setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={i === 0 ? recipe.name : `${recipe.name} — תמונה ${i + 1}`}
            loading={i === 0 ? undefined : "lazy"}
            className="h-full w-full flex-none snap-center bg-rb-soft object-cover"
          />
        ))}
      </div>
      <span
        aria-hidden
        className="absolute end-4 bottom-4 rounded-full bg-black/55 px-3 py-1 text-[15px] font-bold text-white"
      >
        {index + 1}/{urls.length}
      </span>
      <div aria-hidden className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {urls.map((url, i) => (
          <span
            key={url}
            className={`size-2 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </>
  );
}

function QuestionCard({
  question,
  canAnswer,
  canDelete,
}: {
  question: RecipeDetail["questions"][number];
  canAnswer: boolean;
  /** השואל עצמו, או מנהל-על — אותו כלל כמו `recipe_questions_delete` (0023) */
  canDelete: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("answer_recipe_question", {
      p_question_id: question.id,
      p_answer: answer,
    });
    setBusy(false);
    if (rpcError) return setError("התשובה לא נשמרה — ננסה שוב?");
    setOpen(false);
    router.refresh();
  }

  async function removeQuestion() {
    const ok = await confirm({
      title: "מחיקת השאלה",
      message: question.answer ? "השאלה תימחק יחד עם התשובה עליה." : "השאלה תימחק.",
      confirmLabel: "מחיקה",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    // RLS לא מחזיר שגיאה על שורה שאסור למחוק — רק 0 שורות. לכן `select`
    const { data, error: deleteError } = await createClient()
      .from("recipe_questions")
      .delete()
      .eq("id", question.id)
      .select("id");
    setBusy(false);
    if (deleteError || !data?.length) return setError("המחיקה נכשלה — ננסה שוב?");
    router.refresh();
  }

  /** ניקוי תשובה = אותו RPC עם טקסט ריק (0023), ואז אפשר לענות מחדש */
  async function removeAnswer() {
    const ok = await confirm({
      title: "מחיקת התשובה",
      message: "התשובה תימחק, והשאלה תחזור להמתין לתשובה.",
      confirmLabel: "מחיקה",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("answer_recipe_question", {
      p_question_id: question.id,
      p_answer: "",
    });
    setBusy(false);
    if (rpcError) return setError("המחיקה נכשלה — ננסה שוב?");
    setAnswer("");
    router.refresh();
  }

  return (
    <div className="mt-2.5 rounded-[14px] border border-rb-line bg-white px-4 py-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <b>{question.asker_name ?? "בן משפחה"} שאל/ה:</b> {question.text}
        </div>
        {canDelete ? (
          <button
            type="button"
            aria-label="מחיקת השאלה"
            onClick={() => void removeQuestion()}
            disabled={busy}
            className={`${rb.ic} -me-1.5 -mt-1 bg-transparent text-rb-muted disabled:opacity-45`}
          >
            <Icon name="trash" size={18} />
          </button>
        ) : null}
      </div>
      {question.answer ? (
        <div className="mt-2 flex items-start gap-2 border-s-4 border-rb-green ps-3">
          <div className="min-w-0 flex-1">
            <b>{question.answerer_name ?? "תשובה"}:</b> {question.answer}
          </div>
          {canAnswer ? (
            <button
              type="button"
              aria-label="מחיקת התשובה"
              onClick={() => void removeAnswer()}
              disabled={busy}
              className={`${rb.ic} -me-1.5 -mt-1 bg-transparent text-rb-muted disabled:opacity-45`}
            >
              <Icon name="trash" size={18} />
            </button>
          ) : null}
        </div>
      ) : canAnswer ? (
        open ? (
          <form onSubmit={(e) => void send(e)} className="mt-2.5">
            <label htmlFor={`ans-${question.id}`} className="sr-only">
              התשובה שלך
            </label>
            <input
              id={`ans-${question.id}`}
              autoFocus
              className={rb.input}
              maxLength={RECIPE_LIMITS.answer}
              placeholder="התשובה שלך"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <button type="submit" disabled={busy || !answer.trim()} className={`${rb.btn} mt-2`}>
              שליחת תשובה
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${rb.chip} ${rb.chipOff} mt-2.5`}
          >
            תשובה
          </button>
        )
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[15px] font-bold text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
