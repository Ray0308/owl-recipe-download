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
      "description": "新規レシピはnullまたは省略。既存レシピを改善するときは元のrecipe_idを維持する。"
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

const RESTAURANT_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Food Platform Restaurant JSON",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "type", "name"],
  "properties": {
    "schema_version": { "type": "integer", "const": 1 },
    "type": { "type": "string", "const": "restaurant" },
    "restaurant_id": {
      "type": ["string", "null"],
      "description": "新規店舗はnullまたは省略。既存店舗を更新するときは元のrestaurant_idを維持する。"
    },
    "name": { "type": "string", "minLength": 1 },
    "phone": { "type": "string" },
    "address": { "type": "string" },
    "url": { "type": "string" },
    "area": { "type": "string" },
    "genres": { "type": "array", "items": { "type": "string" } },
    "tags": { "type": "array", "items": { "type": "string" } },
    "mood_tags": { "type": "array", "items": { "type": "string" } },
    "notes": { "type": "string" },
    "status": { "type": "string", "enum": ["want_to_visit", "visited", "want_to_revisit"] }
  }
};

const BASE_GPT_PROMPT = `以下のレシピをRecipe Vaultアプリ保存用JSONに変換してください。
説明文、Markdown、コードフェンスは不要です。JSONのみ出力してください。
以下のJSON Schemaに厳密に従ってください。

重要ルール:
- OpenAI APIではなく、ユーザーが手動でこのJSONをアプリへ貼り付けます。
- 新規レシピの場合、recipe_idはnullにするか省略してください。
- 既存レシピを改善する場合、指定されたrecipe_idを必ず維持してください。
- 実際に使用した分量が不明な場合、勝手に確定せずamountは空文字にしてください。
- 写真だけから実際の使用量を推測して確定しないでください。
- tagsは料理ジャンル、主食材、用途など検索しやすい語にしてください。
- mood_tagsは「さっぱり」「がっつり」「簡単」「温かい」「冷たい」「酒に合う」など気分で探しやすい語にしてください。

JSON Schema:
${JSON.stringify(RECIPE_SCHEMA, null, 2)}`;

const BASE_RESTAURANT_GPT_PROMPT = `以下の飲食店情報をFood Platformアプリ保存用Restaurant JSONに変換してください。
説明文、Markdown、コードフェンスは不要です。JSONのみ出力してください。
以下のJSON Schemaに厳密に従ってください。

重要ルール:
- OpenAI APIではなく、ユーザーが手動でこのJSONをアプリへ貼り付けます。
- 新規店舗の場合、restaurant_idはnullにするか省略してください。
- 店名だけで同一店舗判定はしません。
- 不明な項目は推測で確定せず空文字または空配列にしてください。
- statusは行きたい店ならwant_to_visit、行った店ならvisited、また行きたい店ならwant_to_revisitにしてください。

JSON Schema:
${JSON.stringify(RESTAURANT_SCHEMA, null, 2)}`;

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
const homeSectionEl = $("homeSection");
const recipeFormSectionEl = $("recipeFormSection");
const addModalEl = $("addModal");
const restaurantFormSectionEl = $("restaurantFormSection");
const restaurantJsonEl = $("restaurantJson");
const restaurantPhotoEl = $("restaurantPhoto");
const restaurantPreviewEl = $("restaurantPreview");
const restaurantValidationPanelEl = $("restaurantValidationPanel");
const placesSectionEl = $("placesSection");
const restaurantListEl = $("restaurantList");
const homeRestaurantListEl = $("homeRestaurantList");
const restaurantDetailCardEl = $("restaurantDetailCard");
const restaurantDetailTitleEl = $("restaurantDetailTitle");
const restaurantDetailMetaEl = $("restaurantDetailMeta");
const restaurantDetailBodyEl = $("restaurantDetailBody");

let recipes = [];
let currentDetail = null;
let restaurants = [];
let currentRestaurantDetail = null;

$("pasteBtn").addEventListener("click", pasteFromClipboard);
$("previewBtn").addEventListener("click", renderPreview);
$("saveBtn").addEventListener("click", saveRecipe);
$("reloadBtn").addEventListener("click", loadRecipes);
$("copyPromptBtn").addEventListener("click", () => copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。"));
$("copyPromptFromDetailBtn").addEventListener("click", () => copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。"));
$("copyRestaurantPromptBtn").addEventListener("click", () => copyText(BASE_RESTAURANT_GPT_PROMPT, "飲食店用プロンプトをコピーしました。"));
$("copyRecipeBtn").addEventListener("click", copyConsultPrompt);
$("closeDetailBtn").addEventListener("click", () => showView("home"));
$("closeRestaurantDetailBtn").addEventListener("click", () => showView("places"));
$("homeNavBtn").addEventListener("click", () => showView("home"));
$("recipesNavBtn").addEventListener("click", () => showView("recipes"));
$("addNavBtn").addEventListener("click", openAddModal);
$("closeAddModalBtn").addEventListener("click", closeAddModal);
$("addRecipeBtn").addEventListener("click", () => {
  closeAddModal();
  showView("add-recipe");
});
$("addRestaurantBtn").addEventListener("click", () => {
  closeAddModal();
  showView("add-restaurant");
});
$("placesNavBtn").addEventListener("click", () => {
  showView("places");
});
$("cookTodayBtn").addEventListener("click", () => {
  searchInputEl.value = "簡単";
  renderRecipeList();
  recipeListEl.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("eatOutBtn").addEventListener("click", () => {
  showView("places");
});
searchInputEl.addEventListener("input", renderRecipeList);
photoEl.addEventListener("change", () => {
  if (recipeJsonEl.value.trim()) renderPreview();
});
restaurantPhotoEl.addEventListener("change", () => {
  if (restaurantJsonEl.value.trim()) renderRestaurantPreview();
});
recipeListEl.addEventListener("click", handleRecipeListClick);
recipeListEl.addEventListener("keydown", handleRecipeListKeydown);
historyListEl.addEventListener("click", handleHistoryClick);
restaurantListEl.addEventListener("click", handleRestaurantListClick);
restaurantListEl.addEventListener("keydown", handleRestaurantListKeydown);
homeRestaurantListEl.addEventListener("click", handleRestaurantListClick);
homeRestaurantListEl.addEventListener("keydown", handleRestaurantListKeydown);
$("reloadRestaurantsBtn").addEventListener("click", loadRestaurants);
$("pasteRestaurantBtn").addEventListener("click", pasteRestaurantFromClipboard);
$("previewRestaurantBtn").addEventListener("click", renderRestaurantPreview);
$("saveRestaurantBtn").addEventListener("click", saveRestaurant);
restaurantDetailBodyEl.addEventListener("click", handleRestaurantDetailAction);
addModalEl.addEventListener("click", (event) => {
  if (event.target === addModalEl) closeAddModal();
});

handleSaveReturn();
loadRecipes();
loadRestaurants();

function showView(view) {
  const isAddRecipe = view === "add-recipe";
  const isAddRestaurant = view === "add-restaurant";
  const isDetail = view === "detail";
  const isPlaces = view === "places";
  const isRestaurantDetail = view === "restaurant-detail";

  homeSectionEl.classList.toggle("hidden", isAddRecipe || isAddRestaurant || isDetail || isPlaces || isRestaurantDetail);
  recipeFormSectionEl.classList.toggle("hidden", !isAddRecipe);
  restaurantFormSectionEl.classList.toggle("hidden", !isAddRestaurant);
  detailCardEl.classList.toggle("hidden", !isDetail);
  placesSectionEl.classList.toggle("hidden", !isPlaces);
  restaurantDetailCardEl.classList.toggle("hidden", !isRestaurantDetail);

  setCurrentNav(view);

  const target = isAddRecipe
    ? recipeFormSectionEl
    : isAddRestaurant
      ? restaurantFormSectionEl
      : isDetail
        ? detailCardEl
        : isPlaces
          ? placesSectionEl
          : isRestaurantDetail
            ? restaurantDetailCardEl
            : homeSectionEl;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setCurrentNav(view) {
  ["homeNavBtn", "recipesNavBtn", "placesNavBtn"].forEach((id) => $(id).removeAttribute("aria-current"));
  if (view === "recipes") $("recipesNavBtn").setAttribute("aria-current", "page");
  else if (view === "places" || view === "restaurant-detail") $("placesNavBtn").setAttribute("aria-current", "page");
  else if (view !== "add-recipe" && view !== "add-restaurant" && view !== "detail") $("homeNavBtn").setAttribute("aria-current", "page");
}

function openAddModal() {
  addModalEl.classList.remove("hidden");
}

function closeAddModal() {
  addModalEl.classList.add("hidden");
}

async function pasteFromClipboard() {
  try {
    recipeJsonEl.value = await navigator.clipboard.readText();
    renderPreview();
  } catch (error) {
    setStatus("クリップボードを読めませんでした。手動で貼り付けてください。", true);
  }
}

async function pasteRestaurantFromClipboard() {
  try {
    restaurantJsonEl.value = await navigator.clipboard.readText();
    renderRestaurantPreview();
  } catch (error) {
    setStatus("クリップボードを読めませんでした。手動で貼り付けてください。", true);
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

function parseRestaurant() {
  const raw = restaurantJsonEl.value.trim();
  if (!raw) return { ok: false, errors: ["JSONが空です。"], restaurant: null };

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [`JSONとして正しくありません: ${error.message}`], restaurant: null };
  }

  const normalized = normalizeRestaurant(data);
  const errors = validateRestaurant(normalized);
  if (errors.length) return { ok: false, errors, restaurant: normalized };
  return { ok: true, errors: [], restaurant: normalized };
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

function normalizeRestaurant(data) {
  const restaurant = { ...data };

  if (restaurant.schemaVersion && !restaurant.schema_version) restaurant.schema_version = restaurant.schemaVersion;
  if (restaurant.restaurantId && !restaurant.restaurant_id) restaurant.restaurant_id = restaurant.restaurantId;
  if (restaurant.genre && !restaurant.genres) restaurant.genres = [restaurant.genre];
  if (restaurant.moodTags && !restaurant.mood_tags) restaurant.mood_tags = restaurant.moodTags;

  if (!("type" in restaurant)) restaurant.type = "restaurant";
  if (!("restaurant_id" in restaurant)) restaurant.restaurant_id = null;
  if (!("phone" in restaurant)) restaurant.phone = "";
  if (!("address" in restaurant)) restaurant.address = "";
  if (!("url" in restaurant)) restaurant.url = "";
  if (!("area" in restaurant)) restaurant.area = "";
  if (!("genres" in restaurant)) restaurant.genres = [];
  if (!("tags" in restaurant)) restaurant.tags = [];
  if (!("mood_tags" in restaurant)) restaurant.mood_tags = [];
  if (!("notes" in restaurant)) restaurant.notes = "";
  if (!("status" in restaurant)) restaurant.status = "want_to_visit";

  return {
    schema_version: restaurant.schema_version,
    type: restaurant.type,
    restaurant_id: restaurant.restaurant_id,
    name: restaurant.name,
    phone: restaurant.phone,
    address: restaurant.address,
    url: restaurant.url,
    area: restaurant.area,
    genres: restaurant.genres,
    tags: restaurant.tags,
    mood_tags: restaurant.mood_tags,
    notes: restaurant.notes,
    status: restaurant.status
  };
}

function validateRecipe(recipe, expectedRecipeId = null) {
  const errors = [];

  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    return ["ルートはオブジェクトである必要があります。"];
  }

  if (!("schema_version" in recipe)) errors.push("schema_version がありません。");
  if (!("title" in recipe)) errors.push("title がありません。");
  if (!("ingredients" in recipe)) errors.push("ingredients がありません。");
  if (!("steps" in recipe)) errors.push("steps がありません。");

  if (recipe.schema_version !== RECIPE_SCHEMA_VERSION) {
    errors.push(`schema_version は ${RECIPE_SCHEMA_VERSION} である必要があります。`);
  }
  if (recipe.recipe_id !== null && recipe.recipe_id !== undefined && recipe.recipe_id !== "" && typeof recipe.recipe_id !== "string") {
    errors.push("recipe_id は文字列、null、または空である必要があります。");
  }
  if (typeof recipe.title !== "string" || !recipe.title.trim()) {
    errors.push("title は空でない文字列である必要があります。");
  }
  if (!Array.isArray(recipe.ingredients)) {
    errors.push("ingredients が配列ではありません。");
  } else if (recipe.ingredients.length === 0) {
    errors.push("ingredients は1件以上必要です。");
  } else {
    recipe.ingredients.forEach((item, index) => {
      const label = `${index + 1}番目のingredient`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`${label} はオブジェクトである必要があります。`);
        return;
      }
      if (!("name" in item)) {
        errors.push(`${label} にnameがありません。`);
      } else if (typeof item.name !== "string" || !item.name.trim()) {
        errors.push(`${label} のnameは空でない文字列である必要があります。`);
      }
      if (!("amount" in item)) {
        errors.push(`${label} にamountがありません。`);
      } else if (typeof item.amount !== "string") {
        errors.push(`${label} のamountは文字列である必要があります。不明な場合は空文字にしてください。`);
      }
    });
  }
  if (!Array.isArray(recipe.steps)) {
    errors.push("steps が配列ではありません。");
  } else if (recipe.steps.length === 0) {
    errors.push("steps は1件以上必要です。");
  } else {
    recipe.steps.forEach((step, index) => {
      if (typeof step !== "string" || !step.trim()) {
        errors.push(`${index + 1}番目のstepは空でない文字列である必要があります。`);
      }
    });
  }

  validateStringArray(recipe.tags, "tags", errors);
  validateStringArray(recipe.mood_tags, "mood_tags", errors);

  if (!["string", "number"].includes(typeof recipe.servings)) errors.push("servings は文字列または数値である必要があります。");
  if (!["string", "number"].includes(typeof recipe.cooking_time)) errors.push("cooking_time は文字列または数値である必要があります。");
  if (typeof recipe.notes !== "string") errors.push("notes は文字列である必要があります。");
  if (typeof recipe.improvements !== "string") errors.push("improvements は文字列である必要があります。");
  if (expectedRecipeId && recipe.recipe_id !== expectedRecipeId) {
    errors.push(`既存レシピ更新の場合、recipe_id は ${expectedRecipeId} である必要があります。`);
  }

  return errors;
}

function validateRestaurant(restaurant) {
  const errors = [];

  if (!restaurant || typeof restaurant !== "object" || Array.isArray(restaurant)) {
    return ["ルートはオブジェクトである必要があります。"];
  }

  if (!("schema_version" in restaurant)) errors.push("schema_version がありません。");
  if (!("type" in restaurant)) errors.push("type がありません。");
  if (!("name" in restaurant)) errors.push("name がありません。");

  if (restaurant.schema_version !== RECIPE_SCHEMA_VERSION) errors.push(`schema_version は ${RECIPE_SCHEMA_VERSION} である必要があります。`);
  if (restaurant.type !== "restaurant") errors.push("type は restaurant である必要があります。");
  if (restaurant.restaurant_id !== null && restaurant.restaurant_id !== undefined && restaurant.restaurant_id !== "" && typeof restaurant.restaurant_id !== "string") {
    errors.push("restaurant_id は文字列、null、または空である必要があります。");
  }
  if (typeof restaurant.name !== "string" || !restaurant.name.trim()) errors.push("name は空でない文字列である必要があります。");
  if (typeof restaurant.phone !== "string") errors.push("phone は文字列である必要があります。");
  if (typeof restaurant.address !== "string") errors.push("address は文字列である必要があります。");
  if (typeof restaurant.url !== "string") errors.push("url は文字列である必要があります。");
  if (typeof restaurant.area !== "string") errors.push("area は文字列である必要があります。");
  validateStringArray(restaurant.genres, "genres", errors);
  validateStringArray(restaurant.tags, "tags", errors);
  validateStringArray(restaurant.mood_tags, "mood_tags", errors);
  if (typeof restaurant.notes !== "string") errors.push("notes は文字列である必要があります。");
  if (!["want_to_visit", "visited", "want_to_revisit"].includes(restaurant.status)) {
    errors.push("status は want_to_visit、visited、want_to_revisit のいずれかである必要があります。");
  }

  return errors;
}

function validateStringArray(value, key, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${key} が配列ではありません。`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") errors.push(`${key} の${index + 1}番目は文字列である必要があります。`);
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

function renderRestaurantPreview() {
  const result = parseRestaurant();
  renderRestaurantValidation(result.errors);

  if (!result.ok) {
    restaurantPreviewEl.classList.add("hidden");
    setStatus("Restaurant JSONに修正が必要です。", true);
    return;
  }

  restaurantPreviewEl.classList.remove("hidden");
  restaurantPreviewEl.innerHTML = `${selectedRestaurantPhotoHtml()}${restaurantHtml(result.restaurant)}`;
  setStatus("プレビューOK。内容に問題がなければ保存できます。");
}

function selectedPhotoHtml() {
  const file = photoEl.files[0];
  if (!file) return "";
  const url = URL.createObjectURL(file);
  return `<img class="hero-photo" src="${escapeAttribute(url)}" alt="選択した写真">`;
}

function selectedRestaurantPhotoHtml() {
  const file = restaurantPhotoEl.files[0];
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

function renderRestaurantValidation(errors) {
  if (!errors.length) {
    restaurantValidationPanelEl.classList.add("hidden");
    restaurantValidationPanelEl.innerHTML = "";
    return;
  }
  restaurantValidationPanelEl.classList.remove("hidden");
  restaurantValidationPanelEl.innerHTML = `<strong>修正が必要です</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
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
    setStatus("保存画面へ移動します...");
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

    sessionStorage.setItem("recipeVaultPendingTitle", parsed.recipe.title || "");
    submitSaveForm(endpoint, body);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveRestaurant() {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  const parsed = parseRestaurant();
  renderRestaurantValidation(parsed.errors);
  if (!parsed.ok) {
    setStatus("Restaurant JSONを修正してから保存してください。", true);
    return;
  }

  try {
    setStatus("保存画面へ移動します...");
    const photoBase64 = restaurantPhotoEl.files[0] ? await fileToDataUrl(restaurantPhotoEl.files[0]) : null;
    const body = {
      action: "saveRestaurant",
      restaurant: parsed.restaurant,
      photo: photoBase64 ? {
        dataUrl: photoBase64,
        name: restaurantPhotoEl.files[0].name,
        type: restaurantPhotoEl.files[0].type
      } : null
    };

    submitSaveForm(endpoint, body);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function submitSaveForm(endpoint, payload) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = endpoint;
  form.target = "_self";
  form.enctype = "application/x-www-form-urlencoded";
  form.style.display = "none";

  addFormField(form, "payload", JSON.stringify(payload));
  addFormField(form, "response_mode", "htmlRedirect");
  addFormField(form, "return_url", cleanReturnUrl());

  document.body.appendChild(form);
  form.submit();
}

function addFormField(form, name, value) {
  const field = document.createElement("textarea");
  field.name = name;
  field.value = value;
  form.appendChild(field);
}

function handleSaveReturn() {
  const params = new URLSearchParams(window.location.search);
  const saved = params.get("saved");
  const saveError = params.get("save_error");
  const recipeId = params.get("recipe_id");
  const restaurantId = params.get("restaurant_id");
  const version = params.get("version");

  if (!saved && !saveError) return;

  const cleanUrl = cleanReturnUrl();
  window.history.replaceState({}, document.title, cleanUrl);

  if (saved === "1" && restaurantId) {
    setStatus(`保存しました: ${restaurantId}`);
    restaurantJsonEl.value = "";
    restaurantPhotoEl.value = "";
    restaurantPreviewEl.classList.add("hidden");
    restaurantValidationPanelEl.classList.add("hidden");
    window.setTimeout(async () => {
      await loadRestaurants();
      await openRestaurant(restaurantId);
    }, 800);
  } else if (saved === "1") {
    const label = recipeId ? `${recipeId} / Ver.${version || ""}` : "保存しました";
    setStatus(`保存しました: ${label}`);
    recipeJsonEl.value = "";
    photoEl.value = "";
    previewEl.classList.add("hidden");
    validationPanelEl.classList.add("hidden");
    sessionStorage.removeItem("recipeVaultPendingTitle");
    if (recipeId) {
      window.setTimeout(() => openRecipe(recipeId), 800);
    }
  } else if (saveError) {
    setStatus(`保存に失敗しました: ${saveError}`, true);
  }
}

function cleanReturnUrl() {
  const url = new URL(window.location.href);
  ["saved", "save_error", "recipe_id", "restaurant_id", "version"].forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

async function loadRecipes() {
  const endpoint = getEndpoint(false);
  if (!endpoint) {
    setStatus("config.jsにGAS WebアプリURLを設定してください。", true);
    return;
  }

  try {
    const result = await requestJson(`${endpoint}?action=listRecipes&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "一覧を取得できませんでした。");
    recipes = result.items || [];
    renderRecipeList();
    if (!recipes.length) setStatus("保存済みレシピはまだありません。");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadRestaurants() {
  const endpoint = getEndpoint(false);
  if (!endpoint) return;

  try {
    const result = await requestJson(`${endpoint}?action=listRestaurants&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "お店一覧を取得できませんでした。");
    restaurants = result.items || [];
    renderRestaurantLists();
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
      <article class="recipe-item" data-recipe-id="${escapeAttribute(recipe.recipe_id)}" role="button" tabindex="0" aria-label="${escapeAttribute((recipe.title || "レシピ") + "を開く")}">
        ${recipeThumbHtml(recipe)}
        <div class="recipe-item-body">
          <h3>${escapeHtml(recipe.title || "")}</h3>
          <p>${escapeHtml(recipeCardMeta(recipe))}</p>
          <div class="tags">${limitedTagHtml(recipe.tags, "", 2)}${limitedTagHtml(recipe.mood_tags, "mood", 1)}</div>
        </div>
      </article>
    `).join("")
    : `<p class="empty">該当するレシピはありません。</p>`;
}

function renderRestaurantLists() {
  homeRestaurantListEl.innerHTML = restaurants.length
    ? restaurants.slice(0, 3).map(restaurantCardHtml).join("")
    : `<p class="empty">保存済みのお店はまだありません。</p>`;

  restaurantListEl.innerHTML = restaurants.length
    ? restaurants.map(restaurantCardHtml).join("")
    : `<p class="empty">保存済みのお店はまだありません。</p>`;
}

function restaurantCardHtml(restaurant) {
  const meta = restaurant.meta || {};
  return `
    <article class="restaurant-card" data-restaurant-id="${escapeAttribute(restaurant.restaurant_id)}" role="button" tabindex="0" aria-label="${escapeAttribute((restaurant.name || "飲食店") + "を開く")}">
      ${restaurantThumbHtml(restaurant)}
      <div class="restaurant-card-body">
        <h3>${escapeHtml(restaurant.name || "")}</h3>
        <p>${escapeHtml(restaurantCardMeta(restaurant))}</p>
        <div class="tags">${statusTagHtml(meta)}${limitedTagHtml(restaurant.genres, "", 1)}${limitedTagHtml(restaurant.mood_tags, "mood", 1)}</div>
      </div>
    </article>
  `;
}

function restaurantThumbHtml(restaurant) {
  const name = restaurant.name || "飲食店";
  if (!restaurant.image_url) {
    return `<div class="thumb thumb-placeholder" aria-hidden="true"><span>写真なし</span></div>`;
  }
  return `
    <div class="thumb-frame">
      <img class="thumb" src="${escapeAttribute(restaurant.image_url)}" alt="${escapeAttribute(name)}" loading="lazy" onerror="this.closest('.thumb-frame').classList.add('image-missing'); this.remove();">
      <span class="thumb-fallback">写真なし</span>
    </div>
  `;
}

function restaurantCardMeta(restaurant) {
  return [restaurant.area, restaurant.genres].filter(Boolean).join(" / ") || "保存したお店";
}

function statusTagHtml(meta) {
  if (meta.want_to_revisit) return `<span class="tag mood">また行きたい</span>`;
  if (meta.visited) return `<span class="tag">行った</span>`;
  if (meta.want_to_visit) return `<span class="tag">行きたい</span>`;
  return "";
}

async function handleRecipeListClick(event) {
  const card = event.target.closest("[data-recipe-id]");
  if (!card) return;
  await openRecipe(card.dataset.recipeId);
}

async function handleRecipeListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-recipe-id]");
  if (!card) return;
  event.preventDefault();
  await openRecipe(card.dataset.recipeId);
}

async function handleRestaurantListClick(event) {
  const card = event.target.closest("[data-restaurant-id]");
  if (!card) return;
  await openRestaurant(card.dataset.restaurantId);
}

async function handleRestaurantListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-restaurant-id]");
  if (!card) return;
  event.preventDefault();
  await openRestaurant(card.dataset.restaurantId);
}

function recipeThumbHtml(recipe) {
  const title = recipe.title || "レシピ";
  if (!recipe.image_url) {
    return `<div class="thumb thumb-placeholder" aria-hidden="true"><span>写真なし</span></div>`;
  }
  return `
    <div class="thumb-frame">
      <img class="thumb" src="${escapeAttribute(recipe.image_url)}" alt="${escapeAttribute(title)}" loading="lazy" onerror="this.closest('.thumb-frame').classList.add('image-missing'); this.remove();">
      <span class="thumb-fallback">写真なし</span>
    </div>
  `;
}

function photoHeroHtml(imageUrl, title) {
  if (!imageUrl) {
    return `<div class="hero-photo photo-placeholder" aria-hidden="true"><span>写真なし</span></div>`;
  }
  return `
    <div class="photo-hero-frame">
      <img class="hero-photo" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(title || "レシピ写真")}" onerror="this.closest('.photo-hero-frame').classList.add('image-missing'); this.remove();">
      <span class="photo-fallback">写真なし</span>
    </div>
  `;
}

function recipeCardMeta(recipe) {
  const parts = [];
  const recipeData = recipe.recipe || {};
  if (recipeData.cooking_time) parts.push(String(recipeData.cooking_time));
  const ingredients = String(recipe.ingredients_text || "").split("/").map((item) => item.trim()).filter(Boolean);
  if (ingredients.length) parts.push(ingredients.slice(0, 2).join(" / "));
  return parts.join(" ・ ") || "保存したレシピ";
}

async function openRecipe(recipeId, version = null) {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  try {
    setStatus("詳細を取得中...");
    const versionParam = version ? `&version=${encodeURIComponent(version)}` : "";
    const result = await requestJson(`${endpoint}?action=getRecipe&recipe_id=${encodeURIComponent(recipeId)}${versionParam}&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "詳細を取得できませんでした。");
    currentDetail = result.item;
    renderDetail(result.item, result.history || []);
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function openRestaurant(restaurantId) {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  try {
    setStatus("お店の詳細を取得中...");
    const result = await requestJson(`${endpoint}?action=getRestaurant&restaurant_id=${encodeURIComponent(restaurantId)}&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "お店の詳細を取得できませんでした。");
    currentRestaurantDetail = result.item;
    renderRestaurantDetail(result.item);
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderRestaurantDetail(item) {
  const restaurant = item.restaurant || item;
  const meta = item.meta || {};
  restaurantDetailTitleEl.textContent = restaurant.name;
  restaurantDetailMetaEl.textContent = [restaurant.area, (restaurant.genres || []).join(" / ")].filter(Boolean).join(" / ");
  restaurantDetailBodyEl.innerHTML = `
    ${photoHeroHtml(item.image_url, restaurant.name)}
    <div class="restaurant-actions">
      <button type="button" class="status-button ${meta.want_to_visit ? "is-active" : ""}" data-restaurant-action="status" data-status="want_to_visit">行きたい</button>
      <button type="button" class="status-button ${meta.want_to_revisit ? "is-active" : ""}" data-restaurant-action="status" data-status="want_to_revisit">また行きたい</button>
      <button type="button" class="favorite-button" aria-pressed="${meta.favorite ? "true" : "false"}" data-restaurant-action="favorite">${meta.favorite ? "お気に入り済み" : "お気に入り"}</button>
      <button type="button" class="primary-button" data-restaurant-action="visit">今日行った</button>
    </div>
    ${restaurantHtml(restaurant, item)}
  `;
  showView("restaurant-detail");
}

function renderDetail(item, history) {
  const recipe = item.recipe;
  detailTitleEl.textContent = recipe.title;
  const latestVersion = history.length ? Math.max(...history.map((entry) => Number(entry.version) || 0)) : item.version;
  const isPastVersion = Number(item.version) < latestVersion;
  detailMetaEl.textContent = `${isPastVersion ? "過去バージョンを表示中 / " : ""}Ver.${item.version} / ${formatDate(item.created_at)}`;
  detailBodyEl.innerHTML = `
    ${photoHeroHtml(item.image_url, recipe.title)}
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
  showView("detail");
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

function restaurantHtml(restaurant, item = {}) {
  const meta = item.meta || {};
  const mapUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : "";
  return `
    <div class="restaurant-render">
      <div class="fact-grid">
        <div><span>最終訪問日</span><strong>${escapeHtml(formatDate(meta.last_visited_at) || "未記録")}</strong></div>
        <div><span>訪問回数</span><strong>${escapeHtml(String(meta.visit_count || 0))}</strong></div>
      </div>
      <h3>店舗情報</h3>
      <dl class="info-list">
        ${restaurant.area ? `<div><dt>エリア</dt><dd>${escapeHtml(restaurant.area)}</dd></div>` : ""}
        ${restaurant.address ? `<div><dt>住所</dt><dd>${escapeHtml(restaurant.address)}</dd></div>` : ""}
        ${restaurant.phone ? `<div><dt>電話</dt><dd>${escapeHtml(restaurant.phone)}</dd></div>` : ""}
      </dl>
      <div class="button-row">
        ${mapUrl ? `<a class="link-button" href="${escapeAttribute(mapUrl)}" target="_blank" rel="noopener">地図</a>` : ""}
        ${restaurant.url ? `<a class="link-button" href="${escapeAttribute(restaurant.url)}" target="_blank" rel="noopener">店舗ページ</a>` : ""}
        ${restaurant.phone ? `<a class="link-button" href="tel:${escapeAttribute(restaurant.phone)}">電話</a>` : ""}
      </div>
      <h3>ジャンル</h3>
      <div class="tags">${arrayTagHtml(restaurant.genres)}</div>
      <h3>タグ</h3>
      <div class="tags">${arrayTagHtml(restaurant.tags)}${arrayTagHtml(restaurant.mood_tags, "mood")}</div>
      ${restaurant.notes ? `<p><strong>メモ:</strong> ${escapeHtml(restaurant.notes)}</p>` : ""}
    </div>
  `;
}

async function handleRestaurantDetailAction(event) {
  const button = event.target.closest("[data-restaurant-action]");
  if (!button || !currentRestaurantDetail) return;

  const restaurantId = currentRestaurantDetail.restaurant_id;
  const action = button.dataset.restaurantAction;
  let url = "";

  if (action === "favorite") {
    url = `${getEndpoint()}?action=toggleRestaurantFavorite&restaurant_id=${encodeURIComponent(restaurantId)}&_=${Date.now()}`;
  } else if (action === "status") {
    url = `${getEndpoint()}?action=setRestaurantStatus&restaurant_id=${encodeURIComponent(restaurantId)}&status=${encodeURIComponent(button.dataset.status)}&_=${Date.now()}`;
  } else if (action === "visit") {
    url = `${getEndpoint()}?action=recordRestaurantVisit&restaurant_id=${encodeURIComponent(restaurantId)}&_=${Date.now()}`;
  }

  if (!url) return;

  try {
    setStatus("更新中...");
    const result = await requestJson(url);
    if (!result.ok) throw new Error(result.error || "更新できませんでした。");
    currentRestaurantDetail.meta = result.meta;
    await loadRestaurants();
    renderRestaurantDetail(currentRestaurantDetail);
    setStatus("更新しました。");
  } catch (error) {
    setStatus(error.message, true);
  }
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
実際の分量が不明な場合、推測で確定せずamountを空文字にしてください。

JSON Schema:
${JSON.stringify(RECIPE_SCHEMA, null, 2)}`;

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

function arrayTagHtml(value, type = "") {
  return (Array.isArray(value) ? value : String(value || "").split(","))
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => `<span class="tag ${type}">${escapeHtml(tag)}</span>`)
    .join("");
}

function limitedTagHtml(value, type = "", limit = 2) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, limit)
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
