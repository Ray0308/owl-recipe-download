const $ = (id) => document.getElementById(id);

const RECIPE_SCHEMA_VERSION = 1;

const RECIPE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Food Platform Recipe JSON",
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

const BASE_GPT_PROMPT = `以下のレシピをFood Platformアプリ保存用Recipe JSONに変換してください。
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
const ledgerSearchSectionEl = $("ledgerSearchSection");
const recipesSectionEl = $("recipesSection");
const recipeFormSectionEl = $("recipeFormSection");
const addModalEl = $("addModal");
const restaurantFormSectionEl = $("restaurantFormSection");
const restaurantJsonEl = $("restaurantJson");
const restaurantPhotoEl = $("restaurantPhoto");
const restaurantPreviewEl = $("restaurantPreview");
const restaurantValidationPanelEl = $("restaurantValidationPanel");
const placesSectionEl = $("placesSection");
const restaurantListEl = $("restaurantList");
const restaurantDetailCardEl = $("restaurantDetailCard");
const restaurantDetailTitleEl = $("restaurantDetailTitle");
const restaurantDetailMetaEl = $("restaurantDetailMeta");
const restaurantDetailBodyEl = $("restaurantDetailBody");
const quickFiltersEl = $("quickFilters");
const cookingModeModalEl = $("cookingModeModal");
const cookingStepMetaEl = $("cookingStepMeta");
const cookingStepTextEl = $("cookingStepText");
const appTitleEl = $("appTitle");
const headerBackBtnEl = $("headerBackBtn");
const overflowMenuBtnEl = $("overflowMenuBtn");
const overflowMenuEl = $("overflowMenu");
const overflowMenuListEl = $("overflowMenuList");
const detailToolsEl = $("detailTools");

let recipes = [];
let currentDetail = null;
let restaurants = [];
let currentRestaurantDetail = null;
let activeFilters = [];
let cookingSteps = [];
let cookingStepIndex = 0;
let wakeLock = null;
let currentView = "recipes";

$("pasteBtn").addEventListener("click", pasteFromClipboard);
$("previewBtn").addEventListener("click", renderPreview);
$("saveBtn").addEventListener("click", saveRecipe);
$("reloadBtn").addEventListener("click", loadRecipes);
$("copyPromptBtn").addEventListener("click", () => copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。"));
$("copyPromptFromDetailBtn").addEventListener("click", () => copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。"));
$("copyRestaurantPromptBtn").addEventListener("click", () => copyText(BASE_RESTAURANT_GPT_PROMPT, "飲食店用プロンプトをコピーしました。"));
$("copyRecipeBtn").addEventListener("click", copyConsultPrompt);
$("closeDetailBtn").addEventListener("click", () => showView("recipes"));
$("closeRestaurantDetailBtn").addEventListener("click", () => showView("places"));
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
headerBackBtnEl.addEventListener("click", handleHeaderBack);
overflowMenuBtnEl.addEventListener("click", openOverflowMenu);
$("closeOverflowMenuBtn").addEventListener("click", closeOverflowMenu);
overflowMenuEl.addEventListener("click", (event) => {
  if (event.target === overflowMenuEl) closeOverflowMenu();
});
overflowMenuListEl.addEventListener("click", handleOverflowMenuAction);
searchInputEl.addEventListener("input", renderAllLists);
quickFiltersEl.addEventListener("click", handleQuickFilterClick);
$("closeCookingModeBtn").addEventListener("click", closeCookingMode);
$("prevCookingStepBtn").addEventListener("click", () => moveCookingStep(-1));
$("nextCookingStepBtn").addEventListener("click", () => moveCookingStep(1));
photoEl.addEventListener("change", () => {
  if (recipeJsonEl.value.trim()) renderPreview();
});
restaurantPhotoEl.addEventListener("change", () => {
  if (restaurantJsonEl.value.trim()) renderRestaurantPreview();
});
recipeListEl.addEventListener("click", handleRecipeListClick);
recipeListEl.addEventListener("keydown", handleRecipeListKeydown);
historyListEl.addEventListener("click", handleHistoryClick);
detailBodyEl.addEventListener("click", handleRecipeDetailAction);
restaurantListEl.addEventListener("click", handleRestaurantListClick);
restaurantListEl.addEventListener("keydown", handleRestaurantListKeydown);
$("reloadRestaurantsBtn").addEventListener("click", loadRestaurants);
$("pasteRestaurantBtn").addEventListener("click", pasteRestaurantFromClipboard);
$("previewRestaurantBtn").addEventListener("click", renderRestaurantPreview);
$("saveRestaurantBtn").addEventListener("click", saveRestaurant);
restaurantDetailBodyEl.addEventListener("click", handleRestaurantDetailAction);
addModalEl.addEventListener("click", (event) => {
  if (event.target === addModalEl) closeAddModal();
});

showView("recipes");
handleSaveReturn();
loadRecipes();
loadRestaurants();

function showView(view) {
  currentView = view;
  const isAddRecipe = view === "add-recipe";
  const isAddRestaurant = view === "add-restaurant";
  const isDetail = view === "detail";
  const isRecipes = view === "recipes";
  const isPlaces = view === "places";
  const isRestaurantDetail = view === "restaurant-detail";
  const showLedgerSearch = isRecipes || isPlaces;

  ledgerSearchSectionEl.classList.toggle("hidden", !showLedgerSearch);
  if (showLedgerSearch) {
    const activeSection = isPlaces ? placesSectionEl : recipesSectionEl;
    const sectionHead = activeSection.querySelector(".section-head");
    if (sectionHead && ledgerSearchSectionEl.previousElementSibling !== sectionHead) {
      sectionHead.after(ledgerSearchSectionEl);
    }
  }
  recipesSectionEl.classList.toggle("hidden", !isRecipes);
  recipeFormSectionEl.classList.toggle("hidden", !isAddRecipe);
  restaurantFormSectionEl.classList.toggle("hidden", !isAddRestaurant);
  detailCardEl.classList.toggle("hidden", !isDetail);
  placesSectionEl.classList.toggle("hidden", !isPlaces);
  restaurantDetailCardEl.classList.toggle("hidden", !isRestaurantDetail);

  setCurrentNav(view);
  updateAppChrome(view);

  const target = isAddRecipe
    ? recipeFormSectionEl
    : isAddRestaurant
      ? restaurantFormSectionEl
      : isDetail
        ? detailCardEl
        : isRecipes
          ? recipesSectionEl
          : isPlaces
            ? placesSectionEl
            : isRestaurantDetail
              ? restaurantDetailCardEl
              : recipesSectionEl;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  animateView(target);
}

function setCurrentNav(view) {
  ["recipesNavBtn", "placesNavBtn"].forEach((id) => $(id).removeAttribute("aria-current"));
  if (view === "recipes" || view === "detail") $("recipesNavBtn").setAttribute("aria-current", "page");
  else if (view === "places" || view === "restaurant-detail") $("placesNavBtn").setAttribute("aria-current", "page");
}

function updateAppChrome(view) {
  appTitleEl.textContent = "Recipe Vault";
  headerBackBtnEl.classList.toggle("hidden", view === "recipes" || view === "places");
  overflowMenuBtnEl.classList.toggle("hidden", overflowActions(view).length === 0);
}

function handleHeaderBack() {
  if (currentView === "restaurant-detail" || currentView === "add-restaurant") {
    showView("places");
    return;
  }
  showView("recipes");
}

function overflowActions(view = currentView) {
  if (view === "recipes") {
    return [{ id: "reload-recipes", label: "レシピを再読み込み" }];
  }
  if (view === "places") {
    return [{ id: "reload-restaurants", label: "お店を再読み込み" }];
  }
  if (view === "add-recipe") {
    return [{ id: "recipe-prompt", label: "GPT用プロンプトをコピー" }];
  }
  if (view === "add-restaurant") {
    return [{ id: "restaurant-prompt", label: "お店用GPTプロンプトをコピー" }];
  }
  if (view === "detail") {
    return [
      { id: "consult", label: "GPTに相談用コピー" },
      { id: "recipe-prompt", label: "GPT用プロンプトをコピー" },
      { id: "cooking-mode", label: "調理モード" },
      { id: "history", label: "改善履歴を見る" }
    ];
  }
  return [];
}

const baseOverflowActions = overflowActions;
overflowActions = function (view = currentView) {
  const actions = baseOverflowActions(view);
  if (view === "detail") {
    return [
      actions.find((action) => action.id === "consult"),
      { id: "edit-recipe-json", label: "JSONを編集して新規Ver." },
      { id: "copy-recipe-json", label: "保存用JSONをコピー" },
      actions.find((action) => action.id === "recipe-prompt"),
      actions.find((action) => action.id === "cooking-mode"),
      actions.find((action) => action.id === "history"),
      { id: "archive-recipe", label: "台帳から外す" }
    ].filter(Boolean);
  }
  if (view === "restaurant-detail") {
    return [
      { id: "edit-restaurant-json", label: "JSONを編集する" },
      { id: "copy-restaurant-json", label: "保存用JSONをコピー" },
      { id: "archive-restaurant", label: "台帳から外す" }
    ];
  }
  return actions;
};

function openOverflowMenu() {
  const actions = overflowActions();
  if (!actions.length) return;
  overflowMenuListEl.innerHTML = actions
    .map((action) => `<button type="button" data-menu-action="${escapeAttribute(action.id)}">${escapeHtml(action.label)}</button>`)
    .join("");
  overflowMenuEl.classList.remove("hidden");
  animateModal(overflowMenuEl);
}

function closeOverflowMenu() {
  overflowMenuEl.classList.add("hidden");
}

function handleOverflowMenuAction(event) {
  const button = event.target.closest("[data-menu-action]");
  if (!button) return;
  const action = button.dataset.menuAction;
  closeOverflowMenu();

  if (action === "recipe-prompt") {
    copyText(BASE_GPT_PROMPT, "GPT用プロンプトをコピーしました。");
  } else if (action === "restaurant-prompt") {
    copyText(BASE_RESTAURANT_GPT_PROMPT, "お店用GPTプロンプトをコピーしました。");
  } else if (action === "reload-recipes") {
    loadRecipes();
  } else if (action === "reload-restaurants") {
    loadRestaurants();
  } else if (action === "consult") {
    copyConsultPrompt();
  } else if (action === "edit-recipe-json") {
    editCurrentRecipeJson();
  } else if (action === "edit-restaurant-json") {
    editCurrentRestaurantJson();
  } else if (action === "copy-recipe-json") {
    copyCurrentRecipeJson();
  } else if (action === "copy-restaurant-json") {
    copyCurrentRestaurantJson();
  } else if (action === "archive-recipe") {
    archiveCurrentRecipe();
  } else if (action === "archive-restaurant") {
    archiveCurrentRestaurant();
  } else if (action === "cooking-mode") {
    openCookingMode();
  } else if (action === "history" && detailToolsEl) {
    detailToolsEl.classList.remove("menu-only");
    detailToolsEl.open = true;
    detailToolsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function openAddModal() {
  addModalEl.classList.remove("hidden");
  animateModal(addModalEl);
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
    setSaveBusy("recipe", true);
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

    const result = await submitSaveForm(endpoint, body);
    if (!result.ok) throw new Error(result.error || "保存できませんでした。");
    await completeRecipeSave(result);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setSaveBusy("recipe", false);
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
    setSaveBusy("restaurant", true);
    setStatus("保存中...");
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

    const result = await submitSaveForm(endpoint, body);
    if (!result.ok) throw new Error(result.error || "保存できませんでした。");
    await completeRestaurantSave(result);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setSaveBusy("restaurant", false);
  }
}

function setSaveBusy(type, isBusy) {
  const button = type === "restaurant" ? $("saveRestaurantBtn") : $("saveBtn");
  button.disabled = Boolean(isBusy);
  button.textContent = isBusy ? "保存中..." : "保存する";
}

function submitSaveForm(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const requestToken = `save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frameName = `save-frame-${requestToken}`;
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    let settled = false;

    iframe.name = frameName;
    iframe.title = "保存処理";
    iframe.style.display = "none";

    form.method = "POST";
    form.action = endpoint;
    form.target = frameName;
    form.enctype = "application/x-www-form-urlencoded";
    form.style.display = "none";

    addFormField(form, "payload", JSON.stringify(payload));
    addFormField(form, "response_mode", "postMessage");
    addFormField(form, "request_token", requestToken);

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timer);
      window.setTimeout(() => {
        iframe.remove();
        form.remove();
      }, 0);
    };

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error("保存結果を受信できませんでした。通信状態を確認して、一覧を再読み込みしてください。")));
    }, 45000);

    function handleMessage(event) {
      const data = event.data || {};
      if (!data || data.source !== "food-platform-gas" || data.request_token !== requestToken) return;
      finish(() => resolve(data.payload || { ok: false, error: "保存結果が空です。" }));
    }

    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
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

async function completeRecipeSave(result) {
  const recipeId = result.recipe_id || "";
  const version = result.version || "";
  const label = recipeId ? `${recipeId}${version ? ` / Ver.${version}` : ""}` : "保存しました";
  setStatus(`保存しました: ${label}`);
  recipeJsonEl.value = "";
  photoEl.value = "";
  previewEl.classList.add("hidden");
  validationPanelEl.classList.add("hidden");
  sessionStorage.removeItem("recipeVaultPendingTitle");
  await loadRecipes();
  if (recipeId) await openRecipe(recipeId);
  else showView("recipes");
  setStatus(`保存しました: ${label}`);
}

async function completeRestaurantSave(result) {
  const restaurantId = result.restaurant_id || "";
  setStatus(`保存しました: ${restaurantId || "飲食店"}`);
  restaurantJsonEl.value = "";
  restaurantPhotoEl.value = "";
  restaurantPreviewEl.classList.add("hidden");
  restaurantValidationPanelEl.classList.add("hidden");
  await loadRestaurants();
  if (restaurantId) await openRestaurant(restaurantId);
  else showView("places");
  setStatus(`保存しました: ${restaurantId || "飲食店"}`);
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
    renderAllLists();
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
    renderAllLists();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderAllLists() {
  renderQuickFilters();
  renderRecipeList();
  renderRestaurantLists();
}

function currentQueries() {
  return [
    ...searchInputEl.value.trim().toLowerCase().split(/\s+/).filter(Boolean),
    ...activeFilters.map((filter) => filter.toLowerCase())
  ];
}

function renderRecipeList() {
  const queries = currentQueries();
  const filtered = recipes.filter((recipe) => {
    if (recipe.meta?.archived) return false;
    if (!queries.length) return true;
    const haystack = [
      recipe.title,
      recipe.ingredients_text,
      recipe.tags,
      recipe.mood_tags,
      recipe.meta?.favorite ? "お気に入り" : ""
    ].join(" ").toLowerCase();
    return queries.every((query) => haystack.includes(query));
  });

  const markup = filtered.length
    ? filtered.map(recipeCardHtml).join("")
    : `<p class="empty">該当するレシピはありません。</p>`;

  recipeListEl.innerHTML = markup;
  animateLedgerRows(recipeListEl);
}

function recipeCardHtml(recipe) {
  const archiveNo = archiveNumber(recipe.recipe_id, "R");
  return `
    <article class="recipe-item" data-recipe-id="${escapeAttribute(recipe.recipe_id)}" role="button" tabindex="0" aria-label="${escapeAttribute((recipe.title || "レシピ") + "を開く")}">
      <span class="ledger-number">${escapeHtml(archiveNo)}</span>
      <div class="recipe-item-body">
        <h3>${escapeHtml(recipe.title || "")}</h3>
        <p>${escapeHtml(recipeCardMeta(recipe))}</p>
        <div class="tags">${limitedTagHtml(recipe.tags, "", 2)}${limitedTagHtml(recipe.mood_tags, "mood", 1)}</div>
      </div>
    </article>
  `;
}

function renderRestaurantLists() {
  const queries = currentQueries();
  const filtered = restaurants.filter((restaurant) => {
    if (restaurant.meta?.archived) return false;
    if (!queries.length) return true;
    const meta = restaurant.meta || {};
    const statusWords = [
      meta.favorite ? "お気に入り" : "",
      meta.want_to_visit ? "行きたい want_to_visit" : "",
      meta.visited ? "行った visited" : "",
      meta.want_to_revisit ? "また行きたい want_to_revisit" : ""
    ];
    const haystack = [
      restaurant.name,
      restaurant.area,
      restaurant.genres,
      restaurant.tags,
      restaurant.mood_tags,
      statusWords.join(" ")
    ].join(" ").toLowerCase();
    return queries.every((query) => haystack.includes(query));
  });

  restaurantListEl.innerHTML = filtered.length
    ? filtered.map(restaurantCardHtml).join("")
    : `<p class="empty">保存済みのお店はまだありません。</p>`;
  animateLedgerRows(restaurantListEl);
}

function renderQuickFilters() {
  const baseFilters = ["お気に入り", "簡単", "さっぱり", "がっつり", "酒に合う", "行きたい", "また行きたい"];
  const filters = Array.from(new Set(baseFilters)).slice(0, 8);
  quickFiltersEl.innerHTML = filters.map((filter) => `
    <button type="button" class="filter-chip ${activeFilters.includes(filter) ? "is-selected" : ""}" data-filter="${escapeAttribute(filter)}" aria-pressed="${activeFilters.includes(filter) ? "true" : "false"}">${escapeHtml(filter)}</button>
  `).join("");
}

function handleQuickFilterClick(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  const filter = button.dataset.filter;
  activeFilters = activeFilters.includes(filter)
    ? activeFilters.filter((item) => item !== filter)
    : activeFilters.concat(filter);
  renderAllLists();
}

function restaurantCardHtml(restaurant) {
  const meta = restaurant.meta || {};
  const archiveNo = archiveNumber(restaurant.restaurant_id, "P");
  return `
    <article class="restaurant-card" data-restaurant-id="${escapeAttribute(restaurant.restaurant_id)}" role="button" tabindex="0" aria-label="${escapeAttribute((restaurant.name || "飲食店") + "を開く")}">
      <span class="ledger-number">${escapeHtml(archiveNo)}</span>
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
  const archiveNo = archiveNumber(restaurant.restaurant_id, "P");
  if (!restaurant.image_url) {
    return noImageHtml("RESTAURANT", "thumb", archiveNo);
  }
  return `
    <div class="thumb-frame">
      <img class="thumb" src="${escapeAttribute(restaurant.image_url)}" alt="${escapeAttribute(name)}" loading="lazy" onerror="this.closest('.thumb-frame').classList.add('image-missing'); this.remove();">
      ${noImageLabel("RESTAURANT", "thumb-fallback", archiveNo)}
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
  const archiveNo = archiveNumber(recipe.recipe_id, "R");
  if (!recipe.image_url) {
    return noImageHtml("RECIPE", "thumb", archiveNo);
  }
  return `
    <div class="thumb-frame">
      <img class="thumb" src="${escapeAttribute(recipe.image_url)}" alt="${escapeAttribute(title)}" loading="lazy" onerror="this.closest('.thumb-frame').classList.add('image-missing'); this.remove();">
      ${noImageLabel("RECIPE", "thumb-fallback", archiveNo)}
    </div>
  `;
}

function photoHeroHtml(imageUrl, title, archiveLabel = "RECIPE", archiveNo = "") {
  if (!imageUrl) {
    return noImageHtml(archiveLabel, "hero-photo", archiveNo || title || "");
  }
  return `
    <div class="photo-hero-frame">
      <img class="hero-photo" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(title || "レシピ写真")}" onerror="this.closest('.photo-hero-frame').classList.add('image-missing'); this.remove();">
      ${noImageLabel(archiveLabel, "photo-fallback", archiveNo)}
    </div>
  `;
}

function textHeroHtml(kind, archiveNo, title, meta = "") {
  const initial = String(title || kind || "").trim().slice(0, 1).toUpperCase() || "R";
  return `
    <div class="text-hero ${kind === "RESTAURANT" ? "place-hero" : "recipe-hero"}">
      <div class="text-hero-mark" aria-hidden="true">${escapeHtml(initial)}</div>
      <div class="text-hero-body">
        <span>${escapeHtml(kind)} / ${escapeHtml(archiveNo)}</span>
        <h2>${escapeHtml(title)}</h2>
        ${meta ? `<p>${escapeHtml(meta)}</p>` : ""}
      </div>
    </div>
  `;
}

function noImageHtml(label, className, archiveNo = "") {
  const fallbackClass = className.includes("hero") ? "photo-fallback" : "thumb-fallback";
  return `<div class="${escapeAttribute(className)} no-image" aria-hidden="true">${noImageLabel(label, fallbackClass, archiveNo)}</div>`;
}

function noImageLabel(label, className = "thumb-fallback", archiveNo = "") {
  return `<span class="${escapeAttribute(className)}"><em>NO IMAGE</em>${archiveNo ? `<b>${escapeHtml(archiveNo)}</b>` : `<small>${escapeHtml(label)}</small>`}</span>`;
}

function archiveNumber(id, prefix = "R") {
  const raw = String(id || "").trim();
  const digits = raw.match(/\d+/g)?.join("") || "";
  if (digits) return `No.${digits.slice(-4).padStart(3, "0")}`;
  return `${prefix}-No.---`;
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
  const archiveNo = archiveNumber(item.restaurant_id || restaurant.restaurant_id, "P");
  restaurantDetailTitleEl.textContent = restaurant.name;
  restaurantDetailMetaEl.textContent = [restaurant.area, (restaurant.genres || []).join(" / ")].filter(Boolean).join(" / ");
  restaurantDetailBodyEl.innerHTML = `
    ${textHeroHtml("RESTAURANT", archiveNo, restaurant.name || "", [restaurant.area, (restaurant.genres || []).join(" / ")].filter(Boolean).join(" / "))}
    <div class="restaurant-actions">
      <button type="button" class="primary-button" data-restaurant-action="visit">今日行った</button>
      <details class="utility-drawer inline-tools">
        <summary>状態を変更</summary>
        <div class="drawer-body compact-actions">
          <button type="button" class="status-button ${meta.want_to_visit ? "is-active" : ""}" data-restaurant-action="status" data-status="want_to_visit">行きたい</button>
          <button type="button" class="status-button ${meta.want_to_revisit ? "is-active" : ""}" data-restaurant-action="status" data-status="want_to_revisit">また行きたい</button>
          <button type="button" class="favorite-button" aria-pressed="${meta.favorite ? "true" : "false"}" data-restaurant-action="favorite">${meta.favorite ? "お気に入り済み" : "お気に入り"}</button>
        </div>
      </details>
    </div>
    ${restaurantHtml(restaurant, item)}
  `;
  showView("restaurant-detail");
}

function renderDetail(item, history) {
  const recipe = item.recipe;
  const meta = item.meta || {};
  const archiveNo = archiveNumber(item.recipe_id, "R");
  detailTitleEl.textContent = recipe.title;
  const latestVersion = history.length ? Math.max(...history.map((entry) => Number(entry.version) || 0)) : item.version;
  const isPastVersion = Number(item.version) < latestVersion;
  detailMetaEl.textContent = `${isPastVersion ? "過去バージョンを表示中 / " : ""}Ver.${item.version} / ${formatDate(item.created_at)}`;
  detailBodyEl.innerHTML = `
    ${textHeroHtml("RECIPE", `${archiveNo} / Ver.${item.version}`, recipe.title || "", [recipe.servings, recipe.cooking_time].filter(Boolean).join(" / "))}
    <div class="recipe-actions">
      <button type="button" class="primary-button" data-recipe-action="cook">今日作った</button>
      <details class="utility-drawer inline-tools">
        <summary>その他の操作</summary>
        <div class="drawer-body compact-actions">
          <button type="button" class="secondary-button" data-recipe-action="cooking-mode">調理モード</button>
          <button type="button" class="favorite-button" aria-pressed="${meta.favorite ? "true" : "false"}" data-recipe-action="favorite">${meta.favorite ? "お気に入り済み" : "お気に入り"}</button>
        </div>
      </details>
    </div>
    ${recipeUsageHtml(meta)}
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
  if (detailToolsEl) {
    detailToolsEl.classList.add("menu-only");
    detailToolsEl.open = false;
  }
  showView("detail");
}

function recipeUsageHtml(meta) {
  return `
    <div class="fact-grid usage-grid">
      <div><span>最終調理日</span><strong>${escapeHtml(formatDate(meta.last_cooked_at) || "未記録")}</strong></div>
      <div><span>作った回数</span><strong>${escapeHtml(String(meta.cooked_count || 0))}</strong></div>
    </div>
  `;
}

async function handleRecipeDetailAction(event) {
  const button = event.target.closest("[data-recipe-action]");
  if (!button || !currentDetail) return;

  const action = button.dataset.recipeAction;
  if (action === "cooking-mode") {
    openCookingMode();
    return;
  }

  const endpoint = getEndpoint();
  if (!endpoint) return;
  const recipeId = currentDetail.recipe_id;
  const actionName = action === "favorite" ? "toggleRecipeFavorite" : "recordRecipeCook";

  try {
    setStatus("更新中...");
    const result = await requestJson(`${endpoint}?action=${actionName}&recipe_id=${encodeURIComponent(recipeId)}&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "更新できませんでした。");
    currentDetail.meta = result.meta;
    await loadRecipes();
    await openRecipe(recipeId);
    setStatus(action === "favorite" ? "お気に入りを更新しました。" : "今日作った記録を保存しました。");
  } catch (error) {
    setStatus(error.message, true);
  }
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
      <h3><span>INGREDIENTS</span>材料</h3>
      <ul>${recipe.ingredients.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> ${escapeHtml(item.amount)}</li>`).join("")}</ul>
      <h3><span>METHOD</span>作り方</h3>
      <ol>${recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <h3><span>INDEX</span>タグ</h3>
      <div class="tags">${tagHtml(recipe.tags)}</div>
      <h3><span>MOOD</span>気分タグ</h3>
      <div class="tags">${tagHtml(recipe.mood_tags, "mood")}</div>
      ${recipe.notes ? `<section class="note-block"><h3><span>NOTES</span>メモ</h3><p>${escapeHtml(recipe.notes)}</p></section>` : ""}
      ${recipe.improvements ? `<section class="note-block"><h3><span>NEXT</span>次回改善点</h3><p>${escapeHtml(recipe.improvements)}</p></section>` : ""}
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
      <h3><span>PLACE FILE</span>店舗情報</h3>
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
      <h3><span>GENRE</span>ジャンル</h3>
      <div class="tags">${arrayTagHtml(restaurant.genres)}</div>
      <h3><span>INDEX</span>タグ</h3>
      <div class="tags">${arrayTagHtml(restaurant.tags)}${arrayTagHtml(restaurant.mood_tags, "mood")}</div>
      ${restaurant.notes ? `<section class="note-block"><h3><span>NOTES</span>メモ</h3><p>${escapeHtml(restaurant.notes)}</p></section>` : ""}
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

async function openCookingMode() {
  if (!currentDetail || !currentDetail.recipe || !Array.isArray(currentDetail.recipe.steps)) return;
  cookingSteps = currentDetail.recipe.steps;
  cookingStepIndex = 0;
  cookingModeModalEl.classList.remove("hidden");
  renderCookingStep();

  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (error) {
      wakeLock = null;
    }
  }
}

function renderCookingStep() {
  const total = cookingSteps.length;
  cookingStepMetaEl.textContent = total ? `STEP ${cookingStepIndex + 1} / ${total}` : "STEP";
  cookingStepTextEl.textContent = total ? cookingSteps[cookingStepIndex] : "手順がありません。";
  $("prevCookingStepBtn").disabled = cookingStepIndex <= 0;
  $("nextCookingStepBtn").textContent = cookingStepIndex >= total - 1 ? "閉じる" : "次へ";
}

function moveCookingStep(delta) {
  if (!cookingSteps.length) return closeCookingMode();
  if (delta > 0 && cookingStepIndex >= cookingSteps.length - 1) return closeCookingMode();
  cookingStepIndex = Math.min(Math.max(cookingStepIndex + delta, 0), cookingSteps.length - 1);
  renderCookingStep();
}

async function closeCookingMode() {
  cookingModeModalEl.classList.add("hidden");
  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch (error) {
      // ignore release failures
    }
    wakeLock = null;
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

相談後、保存するときはFood Platformアプリ保存用Recipe JSONのみで出力してください。
recipe_idは必ず「${currentDetail.recipe_id}」を維持してください。
実際の分量が不明な場合、推測で確定せずamountを空文字にしてください。

JSON Schema:
${JSON.stringify(RECIPE_SCHEMA, null, 2)}`;

  copyText(prompt, "GPT相談用テキストをコピーしました。");
}

function copyCurrentRecipeJson() {
  if (!currentDetail || !currentDetail.recipe) {
    setStatus("レシピ詳細を開いてから実行してください。", true);
    return;
  }

  copyText(JSON.stringify(currentDetail.recipe, null, 2), "保存用JSONをコピーしました。");
}

function copyCurrentRestaurantJson() {
  if (!currentRestaurantDetail) {
    setStatus("お店詳細を開いてから実行してください。", true);
    return;
  }

  const restaurant = currentRestaurantDetail.restaurant || currentRestaurantDetail;
  copyText(JSON.stringify(restaurant, null, 2), "保存用JSONをコピーしました。");
}

function editCurrentRecipeJson() {
  if (!currentDetail || !currentDetail.recipe) {
    setStatus("レシピ詳細を開いてから実行してください。", true);
    return;
  }

  recipeJsonEl.value = JSON.stringify(currentDetail.recipe, null, 2);
  renderPreview();
  showView("add-recipe");
  setStatus("JSONを編集して保存すると、このレシピの新しいバージョンとして残ります。");
}

function editCurrentRestaurantJson() {
  if (!currentRestaurantDetail) {
    setStatus("お店詳細を開いてから実行してください。", true);
    return;
  }

  const restaurant = currentRestaurantDetail.restaurant || currentRestaurantDetail;
  restaurantJsonEl.value = JSON.stringify(restaurant, null, 2);
  renderRestaurantPreview();
  showView("add-restaurant");
  setStatus("JSONを編集して保存できます。");
}

async function archiveCurrentRecipe() {
  if (!currentDetail) {
    setStatus("レシピ詳細を開いてから実行してください。", true);
    return;
  }

  const recipeId = currentDetail.recipe_id;
  const confirmed = window.confirm("このレシピを通常の台帳から外します。Google Sheets上の記録は残ります。");
  if (!confirmed) return;

  const endpoint = getEndpoint();
  if (!endpoint) return;

  try {
    setStatus("台帳から外しています...");
    const result = await requestJson(`${endpoint}?action=archiveRecipe&recipe_id=${encodeURIComponent(recipeId)}&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "台帳から外せませんでした。");
    await loadRecipes();
    showView("recipes");
    setStatus("レシピを台帳から外しました。");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function archiveCurrentRestaurant() {
  if (!currentRestaurantDetail) {
    setStatus("お店詳細を開いてから実行してください。", true);
    return;
  }

  const restaurantId = currentRestaurantDetail.restaurant_id;
  const confirmed = window.confirm("このお店を通常の台帳から外します。Google Sheets上の記録は残ります。");
  if (!confirmed) return;

  const endpoint = getEndpoint();
  if (!endpoint) return;

  try {
    setStatus("台帳から外しています...");
    const result = await requestJson(`${endpoint}?action=archiveRestaurant&restaurant_id=${encodeURIComponent(restaurantId)}&_=${Date.now()}`);
    if (!result.ok) throw new Error(result.error || "台帳から外せませんでした。");
    await loadRestaurants();
    showView("places");
    setStatus("お店を台帳から外しました。");
  } catch (error) {
    setStatus(error.message, true);
  }
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
  return splitTags(value)
    .map((tag) => `<span class="tag ${type}">${escapeHtml(tag)}</span>`)
    .join("");
}

function arrayTagHtml(value, type = "") {
  return splitTags(value)
    .map((tag) => `<span class="tag ${type}">${escapeHtml(tag)}</span>`)
    .join("");
}

function limitedTagHtml(value, type = "", limit = 2) {
  return splitTags(value)
    .slice(0, limit)
    .map((tag) => `<span class="tag ${type}">${escapeHtml(tag)}</span>`)
    .join("");
}

function splitTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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

function shouldReduceMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateView(element) {
  if (!element || shouldReduceMotion() || !element.animate) return;
  element.animate([
    { opacity: 0, transform: "translateY(8px)" },
    { opacity: 1, transform: "translateY(0)" }
  ], {
    duration: 220,
    easing: "cubic-bezier(.2,.7,.2,1)"
  });
}

function animateLedgerRows(container) {
  if (!container || shouldReduceMotion() || !container.animate) return;
  const rows = Array.from(container.querySelectorAll(".recipe-item, .restaurant-card")).slice(0, 12);
  rows.forEach((row, index) => {
    row.animate([
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" }
    ], {
      duration: 260,
      delay: Math.min(index * 28, 180),
      easing: "cubic-bezier(.2,.7,.2,1)",
      fill: "both"
    });
  });
}

function animateModal(modal) {
  if (!modal || shouldReduceMotion() || !modal.animate) return;
  const panel = modal.querySelector(".modal-panel");
  if (!panel || !panel.animate) return;
  panel.animate([
    { opacity: 0, transform: "translateY(18px) scale(.98)" },
    { opacity: 1, transform: "translateY(0) scale(1)" }
  ], {
    duration: 240,
    easing: "cubic-bezier(.2,.7,.2,1)"
  });
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
