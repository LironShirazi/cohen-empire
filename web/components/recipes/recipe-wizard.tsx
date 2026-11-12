"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { startNavProgress } from "@/components/ui/navigation-progress";
import { rb } from "@/components/recipes/rb";
import { createClient } from "@/lib/supabase/client";
import {
  RECIPE_LIMITS,
  RECIPE_PHOTO_PX,
  RECIPE_THUMB_PX,
} from "@/lib/recipes";
import { removeRecipeUrls, uploadRecipeImage } from "@/lib/recipe-actions";
import type { Recipe } from "@/lib/supabase/types";

/** `image` — קובץ חדש שנבחר; `imageUrl` — תמונה שכבר שמורה (בעריכה) */
type StepDraft = { text: string; image: File | null; imageUrl: string | null };

/** תמונה של המתכון: קובץ חדש, או תמונה שכבר שמורה (בעריכה). הראשונה היא הראשית */
type PhotoDraft = { key: string; file: File | null; url: string | null };

type Saved = {
  name: string;
  owner: string;
  servings: number;
  ingredients: string[];
  steps: string[];
};

const DRAFT_KEY = "recipe-draft";
const TOTAL = 4;

function loadDraft(): Saved | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    // טיוטה פגומה או אחסון חסום — מתחילים נקי
    return null;
  }
}

const noop = () => () => {};

/**
 * הוספת מתכון (7c–7d) — ארבעה שלבים קצרים, שאלה אחת בכל פעם:
 * שם/של מי/מנות → רכיבים → אופן ההכנה → תמונות (הראשונה היא הראשית).
 *
 * ⚠️ **הטיוטה נשמרת בטלפון, אבל רק הטקסט.** אפשר לצאת באמצע ולחזור
 * (localStorage), אבל תמונות לא נכנסות לשם — `File` לא עובר
 * סריאליזציה, ולהעלות אותן מראש היה משאיר קבצים יתומים מכל טיוטה
 * שננטשה. התמונות עולות רק בלחיצה על "שמירת המתכון".
 *
 * ⚠️ **מרונדר רק בדפדפן.** הטיוטה נקראת ב-state ההתחלתי, ובשרת אין
 * localStorage — רינדור בשרת היה יוצא ריק ומתנגש עם הדפדפן (hydration).
 *
 * **עריכה** (`recipe`) היא אותו אשף, מתחיל מהמתכון השמור ובלי טיוטה:
 * localStorage הוא לטיוטה של מתכון חדש, ועריכה שננטשה פשוט לא נשמרת.
 * "שמירה" זמינה בכל שלב — לתקן טעות בשם לא אמור לחייב מעבר על הכל.
 */
export function RecipeWizard(props: {
  userId: string;
  me: string | null;
  suggestions: string[];
  recipe?: Recipe;
}) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  return isClient ? <Wizard {...props} /> : null;
}

function Wizard({
  userId,
  me,
  suggestions,
  recipe,
}: {
  userId: string;
  me: string | null;
  suggestions: string[];
  recipe?: Recipe;
}) {
  const router = useRouter();
  const editing = !!recipe;
  const [draft] = useState<Saved | null>(() =>
    recipe
      ? {
          name: recipe.name,
          owner: recipe.owner_name,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          steps: recipe.steps.map((st) => st.text),
        }
      : loadDraft()
  );
  const [stage, setStage] = useState(1);
  const [name, setName] = useState(draft?.name ?? "");
  const [owner, setOwner] = useState(draft?.owner ?? "");
  const [servings, setServings] = useState(
    typeof draft?.servings === "number" ? draft.servings : 4
  );
  const [ingredients, setIngredients] = useState<string[]>(
    Array.isArray(draft?.ingredients) ? draft.ingredients : []
  );
  const [ingredientDraft, setIngredientDraft] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    Array.isArray(draft?.steps) && draft.steps.length
      ? draft.steps.map((text, i) => ({
          text,
          image: null,
          imageUrl: recipe?.steps[i]?.image_url ?? null,
        }))
      : [{ text: "", image: null, imageUrl: null }]
  );
  const [current, setCurrent] = useState(() =>
    Array.isArray(draft?.steps) && draft.steps.length ? draft.steps.length - 1 : 0
  );
  // הראשונה היא הראשית; כולן רשות (0025), עד RECIPE_LIMITS.photos (0026)
  const [photos, setPhotos] = useState<PhotoDraft[]>(() =>
    recipe
      ? [recipe.photo_url, ...(recipe.extra_photo_urls ?? [])]
          .filter((u): u is string => !!u)
          .map((url) => ({ key: url, file: null, url }))
      : []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    try {
      const saved: Saved = {
        name,
        owner,
        servings,
        ingredients,
        steps: steps.map((s) => s.text),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
    } catch {
      // בלי אחסון — פשוט אין טיוטה
    }
  }, [editing, name, owner, servings, ingredients, steps]);

  const filledSteps = steps.filter((s) => s.text.trim());

  const canContinue =
    stage === 1
      ? name.trim().length > 0 && owner.trim().length > 0
      : stage === 3
        ? filledSteps.length > 0
        : true;

  const canSave =
    !busy &&
    name.trim().length > 0 &&
    owner.trim().length > 0 &&
    filledSteps.length > 0;

  function addIngredient() {
    const text = ingredientDraft.trim();
    if (!text || ingredients.length >= RECIPE_LIMITS.ingredients) return;
    setIngredients((list) => [...list, text]);
    setIngredientDraft("");
  }

  function next() {
    setError(null);
    // רכיב שהוקלד ולא נוסף לרשימה — לא מאבדים אותו במעבר
    if (stage === 2 && ingredientDraft.trim()) addIngredient();
    setStage((s) => Math.min(TOTAL, s + 1));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setError(null);
    setStage((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0 });
  }

  async function save() {
    if (!canSave) return setError("חסר שם, של מי המתכון, או לפחות שלב אחד");
    // רכיב שהוקלד ולא נוסף לרשימה — נכנס גם הוא
    const allIngredients = ingredientDraft.trim()
      ? [...ingredients, ingredientDraft.trim()]
      : ingredients;
    setBusy(true);
    setError(null);
    const uploaded: string[] = [];
    try {
      // בלי תמונות — `null`, והספר מציג אייקון של מנה במקומה
      const photoUrls: string[] = [];
      for (const p of photos) {
        if (p.file) {
          const url = await uploadRecipeImage(userId, p.file, RECIPE_PHOTO_PX);
          uploaded.push(url);
          photoUrls.push(url);
        } else if (p.url) {
          photoUrls.push(p.url);
        }
      }
      const photoUrl = photoUrls[0] ?? null;
      // הממוזערת נגזרת רק מהראשית: חדשה — מעלים; אותה ראשית — שומרים;
      // תמונה נוספת שהועברה לראשית — בלי ממוזערת, והספר נופל ל-photo_url
      let thumbUrl: string | null = null;
      const first = photos[0];
      if (first?.file) {
        thumbUrl = await uploadRecipeImage(userId, first.file, RECIPE_THUMB_PX);
        uploaded.push(thumbUrl);
      } else if (first?.url && first.url === recipe?.photo_url) {
        thumbUrl = recipe.thumb_url;
      }

      const stepRows = [];
      for (const step of filledSteps) {
        let imageUrl = step.imageUrl;
        if (step.image) {
          imageUrl = await uploadRecipeImage(userId, step.image, RECIPE_PHOTO_PX);
          uploaded.push(imageUrl);
        }
        stepRows.push({ text: step.text.trim(), image_url: imageUrl });
      }

      const fields = {
        name: name.trim(),
        owner_name: owner.trim(),
        servings,
        ingredients: allIngredients,
        steps: stepRows,
        photo_url: photoUrl,
        thumb_url: thumbUrl,
        extra_photo_urls: photoUrls.slice(1),
      };

      let id = recipe?.id;
      if (recipe) {
        const { error: updateError } = await createClient()
          .from("recipes")
          .update(fields)
          .eq("id", recipe.id);
        if (updateError) throw updateError;

        // קודם השורה, אחר-כך הקבצים הישנים שאף אחד כבר לא מצביע עליהם
        // (CLAUDE.md §10) — תמונות שהוסרו או הוחלפו, ותמונות שלבים שהוסרו
        const kept = new Set<string>([
          ...photoUrls,
          ...(thumbUrl ? [thumbUrl] : []),
          ...stepRows.flatMap((st) => (st.image_url ? [st.image_url] : [])),
        ]);
        await removeRecipeUrls(
          [
            recipe.photo_url,
            recipe.thumb_url,
            ...(recipe.extra_photo_urls ?? []),
            ...recipe.steps.map((st) => st.image_url),
          ].filter((u) => u && !kept.has(u))
        );
      } else {
        const { data, error: insertError } = await createClient()
          .from("recipes")
          .insert({ ...fields, created_by: userId })
          .select("id")
          .single();
        if (insertError || !data) throw insertError ?? new Error("insert failed");
        id = data.id as string;
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }

      startNavProgress(`/recipes/${id}`);
      router.push(`/recipes/${id}`);
      router.refresh();
    } catch {
      // השורה לא נשמרה — הקבצים שכבר עלו מיותרים, וזו ההזדמנות לנקות
      await removeRecipeUrls(uploaded);
      setBusy(false);
      setError("השמירה נכשלה — ננסה שוב? המתכון עדיין כאן.");
    }
  }

  const title = [editing ? "עריכת מתכון" : "מתכון חדש", "רכיבים", "אופן ההכנה", "תמונות"][
    stage - 1
  ];
  const exitHref = recipe ? `/recipes/${recipe.id}` : "/recipes";

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-rb-line bg-white px-4.5 pt-5 pb-3.5">
        <div className="flex items-center gap-3">
          <Link
            href={exitHref}
            className={rb.ic}
            aria-label={editing ? "יציאה בלי לשמור" : "יציאה לספר — הטיוטה נשמרת"}
          >
            <Icon name="close" size={20} />
          </Link>
          <h1 className="text-[23px] font-extrabold">{title}</h1>
          <span className={`ms-auto text-[15.5px] ${rb.muted}`}>
            שלב {stage} מתוך {TOTAL}
          </span>
          {editing && stage < TOTAL ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className={`${rb.chip} ${rb.chipOn} disabled:opacity-45`}
            >
              {busy ? "שומרים…" : "שמירה"}
            </button>
          ) : null}
        </div>
        <div aria-hidden className="mt-3.5 flex gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded ${i < stage ? "bg-rb-green" : "bg-rb-track"}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 py-5.5">
        {stage === 1 ? (
          <>
            <label htmlFor="rn-name" className={rb.label}>
              איך קוראים למתכון?
            </label>
            <input
              id="rn-name"
              className={rb.input}
              maxLength={RECIPE_LIMITS.name}
              placeholder="למשל: קובה אדומה"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label htmlFor="rn-by" className={`${rb.label} mt-6.5`}>
              של מי המתכון?
            </label>
            <input
              id="rn-by"
              className={rb.input}
              maxLength={RECIPE_LIMITS.owner}
              placeholder="למשל: סבתא טראקי"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <p className={`mt-2 text-[15.5px] ${rb.muted}`}>
              מי שהמציא/ה או מכין/ה אותו. לא חייב להיות מי שמוסיף.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {me ? (
                <OwnerChip label="המתכון שלי" value={me} current={owner} onPick={setOwner} />
              ) : null}
              {suggestions.map((s) => (
                <OwnerChip key={s} label={s} value={s} current={owner} onPick={setOwner} />
              ))}
            </div>

            <div id="rn-serv-l" className={`${rb.label} mt-6.5`}>
              לכמה מנות בערך?
            </div>
            <div role="group" aria-labelledby="rn-serv-l" className="flex items-center gap-4">
              <CountButton label="פחות מנות" onClick={() => setServings((n) => Math.max(1, n - 1))}>
                <Icon name="minus" size={30} />
              </CountButton>
              <div aria-live="polite" className="min-w-20 text-center text-[36px] font-extrabold">
                {servings}
              </div>
              <CountButton label="יותר מנות" onClick={() => setServings((n) => Math.min(99, n + 1))}>
                <Icon name="plus" size={30} />
              </CountButton>
            </div>
          </>
        ) : null}

        {stage === 2 ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addIngredient();
              }}
            >
              <label htmlFor="rn-ing" className={rb.label}>
                רכיב וכמות
              </label>
              <input
                id="rn-ing"
                className={rb.input}
                placeholder="למשל: 2 כוסות סולת"
                value={ingredientDraft}
                onChange={(e) => setIngredientDraft(e.target.value)}
                enterKeyHint="done"
              />
              <button
                type="submit"
                disabled={!ingredientDraft.trim()}
                className={`${rb.btn2} mt-2.5 w-full`}
              >
                <Icon name="plus" size={22} />
                הוספה לרשימה
              </button>
            </form>

            {ingredients.length === 0 ? (
              <p className={`mt-6 text-center text-[16px] ${rb.muted}`}>
                הרכיבים יופיעו כאן אחד מתחת לשני.
              </p>
            ) : (
              <ul className="mt-5">
                {ingredients.map((text, i) => (
                  <li key={i} className="flex items-center gap-3 border-b border-rb-line py-2.5">
                    <span className="min-w-0 flex-1">{text}</span>
                    <button
                      type="button"
                      aria-label={`הסרת ${text}`}
                      onClick={() => setIngredients((list) => list.filter((_, k) => k !== i))}
                      className={rb.ic}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {stage === 3 ? (
          <>
            {steps.map((step, i) =>
              i === current ? (
                <div key={i} className="mt-3 rounded-2xl border-2 border-rb-green bg-white px-4 py-3.5 first:mt-0">
                  <label htmlFor="rn-step" className={`${rb.label} text-rb-green-deep`}>
                    שלב {i + 1} — מה עושים עכשיו?
                  </label>
                  <textarea
                    id="rn-step"
                    className={`${rb.input} h-[104px] resize-none py-3 leading-normal`}
                    placeholder="כתבו במילים שלכם…"
                    value={step.text}
                    onChange={(e) =>
                      setSteps((list) =>
                        list.map((s, k) => (k === i ? { ...s, text: e.target.value } : s))
                      )
                    }
                  />
                  <StepPhoto
                    file={step.image}
                    savedUrl={step.imageUrl}
                    onChange={(image) =>
                      setSteps((list) =>
                        list.map((s, k) =>
                          k === i ? { ...s, image, imageUrl: image ? s.imageUrl : null } : s
                        )
                      )
                    }
                  />
                </div>
              ) : (
                <div key={i} className="mt-3 rounded-2xl border border-rb-line bg-white px-4 py-3.5 first:mt-0">
                  <div className="flex items-center gap-2.5">
                    <b className="text-rb-green-deep">שלב {i + 1}</b>
                    <button
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={`${rb.chip} ${rb.chipOff} ms-auto flex items-center gap-1.5 px-3.5 py-1.5 text-[15px]`}
                    >
                      <Icon name="edit" size={16} />
                      עריכה
                    </button>
                    {steps.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`מחיקת שלב ${i + 1}`}
                        onClick={() => {
                          setSteps((list) => list.filter((_, k) => k !== i));
                          setCurrent((c) => (c > i ? c - 1 : c));
                        }}
                        className={`${rb.chip} ${rb.chipOff} px-3 py-1.5`}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    ) : null}
                  </div>
                  <p className={`mt-1.5 line-clamp-2 ${step.text.trim() ? "" : rb.muted}`}>
                    {step.text.trim() || "(עוד לא נכתב)"}
                  </p>
                  {step.image || step.imageUrl ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[15.5px] font-bold text-rb-green-deep">
                      <Icon name="check" size={18} />
                      תמונה צורפה
                    </p>
                  ) : null}
                </div>
              )
            )}
            {steps.length < RECIPE_LIMITS.steps ? (
              <button
                type="button"
                onClick={() => {
                  setSteps((list) => [...list, { text: "", image: null, imageUrl: null }]);
                  setCurrent(steps.length);
                }}
                className="mt-3 flex min-h-[58px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rb-faint text-[18px] font-bold"
              >
                <Icon name="plus" size={22} />
                עוד שלב
              </button>
            ) : null}
          </>
        ) : null}

        {stage === 4 ? (
          <RecipePhotos photos={photos} onChange={setPhotos} name={name} />
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-[14px] bg-brand-soft px-4 py-2.5 text-[16px] font-bold text-brand">
            {error}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex gap-2.5 border-t border-rb-line bg-white px-4.5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {stage > 1 ? (
          <button type="button" onClick={back} disabled={busy} className={`${rb.btn2} flex-none`}>
            חזרה
          </button>
        ) : null}
        {stage < TOTAL ? (
          <button type="button" onClick={next} disabled={!canContinue} className={`${rb.btn} flex-1`}>
            {["המשך לרכיבים", "המשך לאופן ההכנה", "המשך לתמונות"][stage - 1]}
            <Icon name="forward" size={22} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className={`${rb.btn} flex-1`}
          >
            {busy ? "שומרים…" : editing ? "שמירת השינויים" : "שמירת המתכון"}
          </button>
        )}
      </div>
    </>
  );
}

function OwnerChip({
  label,
  value,
  current,
  onPick,
}: {
  label: string;
  value: string;
  current: string;
  onPick: (v: string) => void;
}) {
  const on = current.trim() === value;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onPick(value)}
      className={`${rb.chip} ${on ? rb.chipOn : rb.chipOff}`}
    >
      {label}
    </button>
  );
}

function CountButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-16 cursor-pointer items-center justify-center rounded-2xl border-2 border-rb-green bg-white text-rb-green active:bg-rb-green-soft"
    >
      {children}
    </button>
  );
}

/** תצוגה מקדימה של קובץ שנבחר — ה-URL משוחרר כשהקובץ מתחלף */
function usePreview(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function StepPhoto({
  file,
  savedUrl,
  onChange,
}: {
  file: File | null;
  savedUrl: string | null;
  onChange: (f: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const preview = usePreview(file) ?? savedUrl;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onChange(f);
        }}
      />
      {preview ? (
        <div className="mt-2.5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="התמונה שצורפה לשלב" className="h-16 w-[84px] rounded-[10px] object-cover" />
          <span className="text-[15.5px] font-bold text-rb-green-deep">תמונה צורפה</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`${rb.chip} ${rb.chipOff} ms-auto px-3.5 py-1.5 text-[15px]`}
          >
            הסרה
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`${rb.btn2} mt-2.5 min-h-[54px] w-full text-[17.5px]`}
        >
          <Icon name="camera" size={22} />
          הוספת תמונה לשלב הזה
        </button>
      )}
    </>
  );
}

/**
 * שלב 4 — תמונות, **רשות** (0025): מתכון מהזיכרון לא תמיד מגיע עם
 * תמונה, ובלי תמונה הספר מציג אייקון של מנה. אפשר כמה (0026) —
 * הראשונה היא הראשית, זו שרואים בספר, ו"לראשית" מקדם אחרת למקומה.
 */
function RecipePhotos({
  photos,
  onChange,
  name,
}: {
  photos: PhotoDraft[];
  onChange: (next: PhotoDraft[]) => void;
  name: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const room = RECIPE_LIMITS.photos - photos.length;

  function add(files: File[]) {
    if (!files.length) return;
    onChange([
      ...photos,
      ...files.slice(0, room).map((file) => ({ key: crypto.randomUUID(), file, url: null })),
    ]);
  }

  return (
    <>
      <p className="text-[18px] font-bold">איך נראה {name.trim() || "המתכון"} כשהוא מוכן?</p>
      <p className={`mt-1 text-[15.5px] ${rb.muted}`}>
        אפשר כמה תמונות. הראשונה היא מה שכולם יראו בספר. צלמו עכשיו או בחרו
        מהגלריה — או דלגו: בלי תמונה יופיע אייקון של מנה.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          add(files);
        }}
      />
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-4 flex aspect-[4/3] w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-rb-faint bg-white"
        >
          <span className="flex flex-col items-center gap-2 text-[18px] font-bold text-rb-green">
            <Icon name="camera" size={44} />
            בחירת תמונות
          </span>
        </button>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <PhotoTile
                key={p.key}
                photo={p}
                index={i}
                onRemove={() => onChange(photos.filter((_, k) => k !== i))}
                onMakeMain={() => onChange([p, ...photos.filter((_, k) => k !== i)])}
              />
            ))}
            {room > 0 ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-rb-faint bg-white text-[17px] font-bold text-rb-green"
              >
                <Icon name="plus" size={34} />
                עוד תמונה
              </button>
            ) : null}
          </div>
          <p className={`mt-3 text-[15px] ${rb.muted}`}>
            {photos.length} מתוך {RECIPE_LIMITS.photos} תמונות
          </p>
        </>
      )}
    </>
  );
}

function PhotoTile({
  photo,
  index,
  onRemove,
  onMakeMain,
}: {
  photo: PhotoDraft;
  index: number;
  onRemove: () => void;
  onMakeMain: () => void;
}) {
  const preview = usePreview(photo.file) ?? photo.url;
  const main = index === 0;
  return (
    <div>
      <div
        className={`relative aspect-square overflow-hidden rounded-2xl bg-rb-soft ${main ? "outline-3 outline-rb-green" : ""}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`תמונה ${index + 1}`} className="h-full w-full object-cover" />
        ) : null}
        {main ? (
          <span className="absolute start-2 bottom-2 rounded-full bg-rb-green px-3 py-1 text-[14.5px] font-bold text-white">
            ראשית
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`הסרת תמונה ${index + 1}`}
          onClick={onRemove}
          className={`${rb.ic} absolute end-2 top-2 bg-white shadow-card`}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      {!main ? (
        <button
          type="button"
          onClick={onMakeMain}
          className={`${rb.chip} ${rb.chipOff} mt-2 w-full px-2 py-1.5 text-[15px]`}
        >
          לתמונה הראשית
        </button>
      ) : null}
    </div>
  );
}
