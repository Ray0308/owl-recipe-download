const $ = (id) => document.getElementById(id);

const RECIPE_SCHEMA_VERSION = 1;

const RECIPE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Recipe Vault JSON",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "title", "ingredients", "steps"],
  "properties": {
    "schema_version": { "type": "integer", "const": 1 },
    "recipe_id": {
      "type": ["string", "null"],
      "description": "新規レシピはnullまたは省略。既存レシピ改良時は元のrecipe_idを維持する。"
    },
    "title": { "type": "string", "minLength": 1 },
    "servings": { "type": ["string", "number"] },
    "ingredients": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "amount"],
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "amount": { "type": "string" }
        }
      }
    },
    "steps": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "minLength": 1 }
    },
    "tags": { "type": "array", "items": { "type": "string" } },
    "mood_tags": { "type": "array", "items": { "type": "string" } },
    "cooking_time": { "type": ["string", "number"] },
    "notes": { "type": "string" },
    "improvements": { "type": "string" }
  }
};

const BASE_GPT_PROMPT = `以下のレシピをRecipe Vaultアプリ保存用JSONに変換してください。
説明文、Markdown、コードフェンスは不要です。JSONのみ出力してください。
以下のJSON Schemaに厳密に従ってください。

重要ルール:
- OpenAI APIではなく、ユーザーが手動でこのJSONをアプリへ貼り付けます。
- 新規レシピの場合、recipe_idはnullにするか省略してください。
- 既存レシピを改良する場合、指定されたrecipe_idを必ず維持してください。
- 実際に使用した分量が不明な場合、勝手に確定せずamountは空文字にしてください。
- 写真だけから実際の使用量を推測して確定しないでください。
- tagsは料理ジャンル、主食材、用途など検索しやすい語にしてください。
- mood_tagsは「さっぱり」「がっつり」「簡単」「温かい」「冷たい」「酒に合う」など気分で探しやすい語にしてください。

JSON Schema:
${JSON.stringify(RECIPE_SCHEMA, null, 2)}`;

const recipeJsonEl = $("recipeJson");
const photoEl = $("photo");
const previewEl = $("preview");
const statusEl = $("status");
const recipeListEl = $("recipeList");
const searchInputEl = $("searchInput");
const validationPanelEl = $("validationPanel");
const detailCardEl = $("detailCard");
const detailTitleEl = $("detailTitle");
const detailMetaEl = $("detailMeta");
const detailBodyEl = $("detailBody");
const historyListEl = $("historyList");

let recipes = [];
let currentDetail = null;

$("pasteBtn").addEventListener("click", pasteFromClipboard);
$("previewBtn").addEventListener("click", renderPreview);
$("saveBtn").addEventListener("click", saveRecipe);
$("reloadBtn").addEventListener("click", loadRecipes);
$("copyPromptBtn").addEventListener("click", () => copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。"));
$("copyPromptFromDetailBtn").addEventListener("click", () => copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。"));
$("copyRecipeBtn").addEventListener("click", copyConsultPrompt);
$("closeDetailBtn").addEventListener("click", () => detailCardEl.classList.add("hidden"));
searchInputEl.addEventListener("input", renderRecipeList);
photoEl.addEventListener("change", () => {
  if (recipeJsonEl.value.trim()) renderPreview();
});
recipeListEl.addEventListener("click", handleRecipeListClick);
historyListEl.addEventListener("click", handleHistoryClick);

loadRecipes();

async function pasteFromClipboard() {
  try {
    recipeJsonEl.value = await navigator.clipboard.readText();
    renderPreview();
  } catch (error) {
    setStatus("クリップボードを読み取れませんでした。手動で貼り付けてください。", true);
  }
}

function parseRecipe() {
  const raw = recipeJsonEl.value.trim();
  if (!raw) return { ok: false, errors: ["JSONが空です。"], recipe: null };

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [`JSONとして正しくありません: ${error.message}`], recipe: null };
  }

  const normalized = normalizeRecipe(data);
  const errors = validateRecipe(normalized);
  if (errors.length) return { ok: false, errors, recipe: normalized };
  return { ok: true, errors: [], recipe: normalized };
}

function normalizeRecipe(data) {
  const recipe = { ...data };

  if (recipe.schemaVersion && !recipe.schema_version) recipe.schema_version = recipe.schemaVersion;
  if (recipe.recipeId && !recipe.recipe_id) recipe.recipe_id = recipe.recipeId;
  if (recipe.moodTags && !recipe.mood_tags) recipe.mood_tags = recipe.moodTags;
  if (recipe.cookingTimeMinutes && !recipe.cooking_time) recipe.cooking_time = recipe.cookingTimeMinutes;
  if (recipe.memo && !recipe.notes) recipe.notes = recipe.memo;
  if (recipe.summary && !recipe.notes) recipe.notes = recipe.summary;

  if (!("recipe_id" in recipe)) recipe.recipe_id = null;
  if (!("servings" in recipe)) recipe.servings = "";
  if (!("tags" in recipe)) recipe.tags = [];
  if (!("mood_tags" in recipe)) recipe.mood_tags = [];
  if (!("cooking_time" in recipe)) recipe.cooking_time = "";
  if (!("notes" in recipe)) recipe.notes = "";
  if (!("improvements" in recipe)) recipe.improvements = "";

  return {
    schema_version: recipe.schema_version,
    recipe_id: recipe.recipe_id,
    title: recipe.title,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: recipe.tags,
    mood_tags: recipe.mood_tags,
    cooking_time: recipe.cooking_time,
    notes: recipe.notes,
    improvements: recipe.improvements
  };
}

function validateRecipe(recipe, expectedRecipeId = null) {
  const errors = [];

  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    return ["ルートはオブジェクトである必要があります。"];
  }

  if (!("schema_version" in recipe)) errors.push("schema_versionがありません。");
  if (!("title" in recipe)) errors.push("titleがありません。");
  if (!("ingredients" in recipe)) errors.push("ingredientsがありません。");
  if (!("steps" in recipe)) errors.push("stepsがありません。");

  if (recipe.schema_version !== RECIPE_SCHEMA_VERSION) {
    errors.push(`schema_versionは${RECIPE_SCHEMA_VERSION}である必要があります。`);
  }
  if (recipe.recipe_id !== null && recipe.recipe_id !== undefined && recipe.recipe_id !== "" && typeof recipe.recipe_id !== "string") {
    errors.push("recipe_idは文字列、null、または省略である必要があります。");
  }
  if (typeof recipe.title !== "string" || !recipe.title.trim()) {
    errors.push("titleは空でない文字列である必要があります。");
  }
  if (!Array.isArray(recipe.ingredients)) {
    errors.push("ingredientsが配列ではありません。");
  } else if (recipe.ingredients.length === 0) {
    errors.push("ingredientsは1件以上必要です。");
  } else {
    recipe.ingredients.forEach((item, index) => {
      const label = `${index + 1}番目のingredient`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`${label}はオブジェクトである必要があります。`);
        return;
      }
      if (!("name" in item)) {
        errors.push(`${label}にnameがありません。`);
      } else if (typeof item.name !== "string" || !item.name.trim()) {
        errors.push(`${label}のnameは空でない文字列である必要があります。`);
      }
      if (!("amount" in item)) {
        errors.push(`${label}にamountがありません。`);
      } else if (typeof item.amount !== "string") {
        errors.push(`${label}のamountは文字列である必要があります。不明な場合は空文字にしてください。`);
      }
    });
  }
  if (!Array.isArray(recipe.steps)) {
    errors.push("stepsが配列ではありません。");
  } else if (recipe.steps.length === 0) {
    errors.push("stepsは1件以上必要です。");
  } else {
    recipe.steps.forEach((step, index) => {
      if (typeof step !== "string" || !step.trim()) {
        errors.push(`${index + 1}番目のstepは空でない文字列である必要があります。`);
      }
    });
  }

  validateStringArray(recipe.tags, "tags", errors);
  validateStringArray(recipe.mood_tags, "mood_tags", errors);

  if (!["string", "number"].includes(typeof recipe.servings)) errors.push("servingsは文字列または数値である必要があります。");
  if (!["string", "number"].includes(typeof recipe.cooking_time)) errors.push("cooking_timeは文字列または数値である必要があります。");
  if (typeof recipe.notes !== "string") errors.push("notesは文字列である必要があります。");
  if (typeof recipe.improvements !== "string") errors.push("improvementsは文字列である必要があります。");
  if (expectedRecipeId && recipe.recipe_id !== expectedRecipeId) {
    errors.push(`既存レシピ更新の場合、recipe_idは${expectedRecipeId}である必要があります。`);
  }

  return errors;
}

function validateStringArray(value, key, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${key}が配列ではありません。`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") errors.push(`${key}の${index + 1}番目は文字列である必要があります。`);
  });
}

function renderPreview() {
  const result = parseRecipe();
  renderValidation(result.errors);

  if (!result.ok) {
    previewEl.classList.add("hidden");
    setStatus("JSONに修正が必要です。", true);
    return;
  }

  previewEl.classList.remove("hidden");
  previewEl.innerHTML = `${selectedPhotoHtml()}${recipeHtml(result.recipe)}`;
  setStatus("プレビューOK。内容に問題がなければ保存できます。");
}

function selectedPhotoHtml() {
  const file = photoEl.files[0];
  if (!file) return "";
  const url = URL.createObjectURL(file);
  return `<img class="hero-photo" src="${escapeAttribute(url)}" alt="選択した写真">`;
}

function renderValidation(errors) {
  if (!errors.length) {
    validationPanelEl.classList.add("hidden");
    validationPanelEl.innerHTML = "";
    return;
  }
  validationPanelEl.classList.remove("hidden");
  validationPanelEl.innerHTML = `<strong>修正が必要です</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
}

async function saveRecipe() {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  const parsed = parseRecipe();
  renderValidation(parsed.errors);
  if (!parsed.ok) {
    setStatus("JSONを修正してから保存してください。", true);
    return;
  }

  try {
    setStatus("保存中...");
    const photoBase64 = photoEl.files[0] ? await fileToDataUrl(photoEl.files[0]) : null;
    const body = {
      action: "saveRecipe",
      recipe: parsed.recipe,
      photo: photoBase64 ? {
        dataUrl: photoBase64,
        name: photoEl.files[0].name,
        type: photoEl.files[0].type
      } : null
    };

    const result = await requestJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });

    if (!result.ok) throw new Error(result.error || "保存に失敗しました。");

    setStatus(`保存しました: ${result.recipe_id} / Ver.${result.version}`);
    recipeJsonEl.value = "";
    photoEl.value = "";
    previewEl.classList.add("hidden");
    validationPanelEl.classList.add("hidden");
    await loadRecipes();
    await openRecipe(result.recipe_id);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadRecipes() {
  const endpoint = getEndpoint(false);
  if (!endpoint) {
    setStatus("config.jsにGAS WebアプリURLを設定してください。", true);
    return;
  }

  try {
    const result = await requestJson(`${endpoint}?action=listRecipes`);
    if (!result.ok) throw new Error(result.error || "一覧を取得できませんでした。");
    recipes = result.items || [];
    renderRecipeList();
    if (!recipes.length) setStatus("保存済みレシピはまだありません。");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderRecipeList() {
  const queries = searchInputEl.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = recipes.filter((recipe) => {
    if (!queries.length) return true;
    const haystack = [
      recipe.title,
      recipe.ingredients_text,
      recipe.tags,
      recipe.mood_tags
    ].join(" ").toLowerCase();
    return queries.every((query) => haystack.includes(query));
  });

  recipeListEl.innerHTML = filtered.length
    ? filtered.map((recipe) => `
      <article class="recipe-item">
        ${recipe.image_url ? `<img class="thumb" src="${escapeAttribute(recipe.image_url)}" alt="">` : ""}
        <div class="recipe-item-body">
          <h3>${escapeHtml(recipe.title || "")}</h3>
          <p>Ver.${escapeHtml(String(recipe.version || ""))} / ${formatDate(recipe.created_at)}</p>
          <div class="tags">${tagHtml(recipe.tags)}${tagHtml(recipe.mood_tags, "mood")}</div>
          <button type="button" data-recipe-id="${escapeAttribute(recipe.recipe_id)}">詳細を見る</button>
        </div>
      </article>
    `).join("")
    : `<p class="empty">該当するレシピはありません。</p>`;
}

async function handleRecipeListClick(event) {
  const button = event.target.closest("[data-recipe-id]");
  if (!button) return;
  await openRecipe(button.dataset.recipeId);
}

async function openRecipe(recipeId, version = null) {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  try {
    setStatus("詳細を取得中...");
    const versionParam = version ? `&version=${encodeURIComponent(version)}` : "";
    const result = await requestJson(`${endpoint}?action=getRecipe&recipe_id=${encodeURIComponent(recipeId)}${versionParam}`);
    if (!result.ok) throw new Error(result.error || "詳細を取得できませんでした。");
    currentDetail = result.item;
    renderDetail(result.item, result.history || []);
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderDetail(item, history) {
  const recipe = item.recipe;
  detailCardEl.classList.remove("hidden");
  detailTitleEl.textContent = recipe.title;
  detailMetaEl.textContent = `Recipe ID: ${item.recipe_id} / Ver.${item.version} / ${formatDate(item.created_at)}`;
  detailBodyEl.innerHTML = `
    ${item.image_url ? `<img class="hero-photo" src="${escapeAttribute(item.image_url)}" alt="${escapeAttribute(recipe.title)}">` : ""}
    ${recipeHtml(recipe)}
  `;
  historyListEl.innerHTML = history.length
    ? history.map((entry) => `
      <button class="history-item ${entry.version === item.version ? "active" : ""}" type="button" data-history-id="${escapeAttribute(entry.recipe_id)}" data-version="${escapeAttribute(entry.version)}">
        <span>Ver.${escapeHtml(entry.version)}</span>
        <small>${formatDate(entry.created_at)}</small>
      </button>
    `).join("")
    : `<p class="empty">履歴はありません。</p>`;
  detailCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleHistoryClick(event) {
  const button = event.target.closest("[data-history-id]");
  if (!button) return;
  await openRecipe(button.dataset.historyId, button.dataset.version);
}

function recipeHtml(recipe) {
  return `
    <div class="recipe-render">
      <div class="fact-grid">
        <div><span>人数</span><strong>${escapeHtml(recipe.servings || "未設定")}</strong></div>
        <div><span>調理時間</span><strong>${escapeHtml(recipe.cooking_time || "未設定")}</strong></div>
      </div>
      <h3>材料</h3>
      <ul>${recipe.ingredients.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> ${escapeHtml(item.amount)}</li>`).join("")}</ul>
      <h3>作り方</h3>
      <ol>${recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <h3>タグ</h3>
      <div class="tags">${tagHtml(recipe.tags)}</div>
      <h3>気分タグ</h3>
      <div class="tags">${tagHtml(recipe.mood_tags, "mood")}</div>
      ${recipe.notes ? `<p><strong>メモ:</strong> ${escapeHtml(recipe.notes)}</p>` : ""}
      ${recipe.improvements ? `<p><strong>次回改善点:</strong> ${escapeHtml(recipe.improvements)}</p>` : ""}
    </div>
  `;
}

function copyConsultPrompt() {
  if (!currentDetail) {
    setStatus("先にレシピ詳細を開いてください。", true);
    return;
  }

  const recipe = currentDetail.recipe;
  const ingredients = recipe.ingredients.map((item) => `・${item.name}${item.amount ? `: ${item.amount}` : ""}`).join("\n");
  const steps = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");

  const prompt = `このレシピについて相談します。
料理名:
${recipe.title}

Recipe ID:
${currentDetail.recipe_id}

現在のバージョン:
Ver.${currentDetail.version}

人数:
${recipe.servings || ""}

調理時間:
${recipe.cooking_time || ""}

材料:
${ingredients}

作り方:
${steps}

通常タグ:
${recipe.tags.join(", ")}

気分タグ:
${recipe.mood_tags.join(", ")}

前回メモ:
${recipe.notes || ""}

次回改善点:
${recipe.improvements || ""}

相談後、保存するときはRecipe Vaultアプリ保存用JSONのみで出力してください。
recipe_idは必ず「${currentDetail.recipe_id}」を維持してください。
実際の分量が不明な場合は、推測で確定せずamountを空文字にしてください。`;

  copyText(prompt, "GPT相談用テキストをコピーしました。");
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(message);
  } catch (error) {
    setStatus("クリップボードへコピーできませんでした。", true);
  }
}

function getEndpoint(showError = true) {
  const endpoint = window.APP_CONFIG?.GAS_ENDPOINT;
  if (!endpoint || endpoint.includes("PASTE_YOUR")) {
    if (showError) setStatus("config.jsにGAS WebアプリURLを設定してください。", true);
    return "";
  }
  return endpoint;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`サーバー応答をJSONとして読めませんでした。HTTP ${response.status}`);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("写真を読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function tagHtml(value, type = "") {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => `<span class="tag ${type}">${escapeHtml(tag)}</span>`)
    .join("");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
