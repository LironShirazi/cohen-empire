"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { RecipeImage, rb } from "@/components/recipes/rb";
import type { RecipeListItem } from "@/lib/recipes-data";
import {
  matchesRecipe,
  searchPatterns,
  servingsLabel,
  splitMatch,
} from "@/lib/recipes";

/**
 * הספר (7a) — רשימה ולא רשת: שורה גדולה לכל מתכון עם תמונה, שם, של
 * מי וכמה מנות. החיפוש מסנן תוך כדי הקלדה ומדגיש את ההתאמה; הכפתורים
 * "מתכונים של" מוצאים בלי להקליד בכלל.
 */
export function RecipeBook({ recipes }: { recipes: RecipeListItem[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  const patterns = useMemo(() => searchPatterns(query), [query]);
  const found = useMemo(
    () => (patterns.length ? recipes.filter((r) => matchesRecipe(r, patterns)) : recipes),
    [recipes, patterns]
  );
  const owners = useMemo(
    () => [...new Set(recipes.map((r) => r.owner_name.trim()))],
    [recipes]
  );

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-rb-line bg-white px-4.5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/" className={rb.ic} aria-label="חזרה לדף הבית">
            <Icon name="back" size={22} />
          </Link>
          <div>
            <h1 className="text-[26px] leading-tight font-extrabold">ספר המתכונים</h1>
            <p className={`text-[15px] ${rb.muted}`}>
              {recipes.length === 1 ? "מתכון אחד מהמשפחה" : `${recipes.length} מתכונים מהמשפחה`}
            </p>
          </div>
        </div>

        {recipes.length > 0 ? (
          <>
            <div className="relative mt-3.5">
              <label htmlFor="rb-q" className="sr-only">
                חיפוש מתכון לפי שם המתכון או שם בעל המתכון
              </label>
              <Icon
                name="search"
                size={22}
                className="pointer-events-none absolute start-[15px] top-[18px] text-rb-muted"
              />
              <input
                id="rb-q"
                type="search"
                className={`${rb.input} px-12 [&::-webkit-search-cancel-button]:hidden`}
                placeholder="שם מתכון או של מי הוא"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="ניקוי החיפוש"
                  className="absolute end-2 top-2 flex size-[42px] items-center justify-center rounded-full bg-rb-soft"
                >
                  <Icon name="close" size={17} />
                </button>
              ) : null}
            </div>

            {owners.length > 1 ? (
              <div className="mt-3 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
                <span className={`flex-none text-[15px] ${rb.muted}`}>מתכונים של:</span>
                {owners.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={q === name}
                    onClick={() => setQuery(q === name ? "" : name)}
                    className={`${rb.chip} ${q === name ? rb.chipOn : rb.chipOff}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex-1 px-4.5 pt-1 pb-3">
        {q ? (
          <p aria-live="polite" className={`pt-2.5 pb-0.5 text-[15.5px] ${rb.muted}`}>
            {found.length === 0
              ? ""
              : found.length === 1
                ? "נמצא מתכון אחד"
                : `נמצאו ${found.length} מתכונים`}
          </p>
        ) : null}

        {recipes.length === 0 ? (
          <div className="px-2.5 py-11 text-center">
            <Icon name="book" size={56} className="mx-auto text-rb-green" />
            <h2 className="mt-2 text-[21px] font-extrabold">הספר עוד ריק</h2>
            <p className={`mt-1.5 text-[16.5px] ${rb.muted}`}>
              המתכון של סבתא, העוגה של דודה, הסלט מכל ארוחת שישי — הם מתחילים
              כאן. אפשר להוסיף גם מתכון של מי שלא משתמש באפליקציה.
            </p>
          </div>
        ) : found.length === 0 ? (
          <div className="px-2.5 py-11 text-center">
            <Icon name="search" size={52} className="mx-auto text-rb-muted" />
            <h2 className="mt-2 text-[21px] font-extrabold">לא מצאנו מתכון כזה</h2>
            <p className={`mt-1.5 mb-4.5 text-[16.5px] ${rb.muted}`}>
              נסו מילה אחת בלבד, או רק חלק מהמילה.
            </p>
            <button type="button" className={`${rb.btn2} mx-auto`} onClick={() => setQuery("")}>
              הצגת כל המתכונים
            </button>
          </div>
        ) : (
          found.map((recipe) => {
            const [na, nm, nb] = splitMatch(recipe.name, patterns);
            const [ca, cm, cb] = splitMatch(recipe.owner_name, patterns);
            return (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="flex items-center gap-3.5 border-b border-rb-line py-3 text-rb-ink"
              >
                <RecipeImage
                  url={recipe.thumb_url ?? recipe.photo_url}
                  alt=""
                  iconSize={40}
                  lazy
                  className="size-[78px] flex-none rounded-2xl"
                />
                <span className="min-w-0 flex-1">
                  <b className="block text-[19.5px] leading-snug">
                    {na}
                    {nm ? <mark className="rounded-[3px] bg-rb-mark text-inherit">{nm}</mark> : null}
                    {nb}
                  </b>
                  <span className={`block text-[16px] ${rb.muted}`}>
                    של {ca}
                    {cm ? <mark className="rounded-[3px] bg-rb-mark text-inherit">{cm}</mark> : null}
                    {cb} · {servingsLabel(recipe.servings)}
                  </span>
                </span>
                <Icon name="forward" size={24} className="text-rb-faint" />
              </Link>
            );
          })
        )}
      </div>

      <div className="sticky bottom-0 border-t border-rb-line bg-white px-4.5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Link href="/recipes/new" className={rb.btn}>
          <Icon name="plus" size={24} />
          הוספת מתכון
        </Link>
      </div>
    </>
  );
}
