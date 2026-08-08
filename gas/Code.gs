const SHEET_NAME = "recipes";
const SCHEMA_VERSION = 1;
const HEADERS = [
  "recipe_id",
  "version",
  "title",
  "ingredients_text",
  "tags",
  "mood_tags",
  "image_file_id",
  "recipe_json",
  "created_at"
];

// Script Properties:
// SPREADSHEET_ID: Google Sheets "Recipe DB" のID
// DRIVE_FOLDER_ID: Google Drive "Recipe Photos" フォルダのID

function doGet(e) {
  try {
    const action = String(e.parameter.action || "");

    if (action === "listRecipes") {
      return jsonResponse({ ok: true, items: listLatestRecipes() });
    }

    if (action === "getRecipe") {
      const recipeId = e.parameter.recipe_id || e.parameter.recipeId || "";
      const version = e.parameter.version ? Number(e.parameter.version) : null;
      return jsonResponse(getRecipe(recipeId, version));
    }

    return jsonResponse({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");

    if (payload.action === "saveRecipe") {
      return jsonResponse(Object.assign({ ok: true }, saveRecipe(payload.recipe, payload.photo)));
    }

    return jsonResponse({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function saveRecipe(inputRecipe, photo) {
  const recipe = normalizeRecipe(inputRecipe);
  validateRecipe(recipe);

  const sheet = getSheet();
  ensureHeader(sheet);
  const records = readRecords(sheet);

  const suppliedRecipeId = recipe.recipe_id || "";
  let recipeId = suppliedRecipeId;
  let version = 1;
  let imageFileId = "";

  if (suppliedRecipeId) {
    const existing = records.filter(function (record) {
      return record.recipe_id === suppliedRecipeId;
    });
    if (existing.length === 0) {
      throw new Error("指定されたrecipe_idの既存レシピが見つかりません: " + suppliedRecipeId);
    }
    version = Math.max.apply(null, existing.map(function (record) {
      return Number(record.version) || 0;
    })) + 1;
    imageFileId = latestRecord(existing).image_file_id || "";
  } else {
    recipeId = Utilities.getUuid();
    recipe.recipe_id = recipeId;
  }

  if (photo && photo.dataUrl) {
    imageFileId = savePhoto(photo, recipeId, version);
  }

  const record = {
    recipe_id: recipeId,
    version: version,
    title: recipe.title,
    ingredients_text: ingredientsText(recipe),
    tags: recipe.tags.join(","),
    mood_tags: recipe.mood_tags.join(","),
    image_file_id: imageFileId,
    recipe_json: JSON.stringify(recipe),
    created_at: new Date()
  };

  appendRecord(sheet, record);

  return {
    recipe_id: recipeId,
    version: version,
    image_file_id: imageFileId,
    image_url: imageUrl(imageFileId)
  };
}

function listLatestRecipes() {
  const sheet = getSheet();
  ensureHeader(sheet);

  const latest = {};
  readRecords(sheet).forEach(function (record) {
    if (!latest[record.recipe_id] || latest[record.recipe_id].version < record.version) {
      latest[record.recipe_id] = record;
    }
  });

  return Object.keys(latest)
    .map(function (key) {
      return publicRecord(latest[key], false);
    })
    .sort(function (a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function getRecipe(recipeId, version) {
  if (!recipeId) throw new Error("recipe_id is required.");

  const sheet = getSheet();
  ensureHeader(sheet);

  const records = readRecords(sheet)
    .filter(function (record) {
      return record.recipe_id === recipeId;
    })
    .sort(function (a, b) {
      return a.version - b.version;
    });

  if (records.length === 0) {
    return { ok: false, error: "レシピが見つかりません。" };
  }

  let selected = null;
  if (version) {
    selected = records.find(function (record) {
      return record.version === version;
    });
    if (!selected) return { ok: false, error: "指定されたバージョンが見つかりません。" };
  } else {
    selected = records[records.length - 1];
  }

  return {
    ok: true,
    item: publicRecord(selected, true),
    history: records.map(function (record) {
      return {
        recipe_id: record.recipe_id,
        version: record.version,
        title: record.title,
        created_at: record.created_at
      };
    }).reverse()
  };
}

function appendRecord(sheet, record) {
  const headers = getHeaders(sheet);
  const row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
  });
  sheet.appendRow(row);
}

function readRecords(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(function (value) {
    return String(value);
  });
  const index = {};
  headers.forEach(function (header, i) {
    index[header] = i;
  });

  return values.slice(1)
    .filter(function (row) {
      return row[index.recipe_id] !== "";
    })
    .map(function (row) {
      const recipeJson = String(row[index.recipe_json] || "{}");
      let recipe = {};
      try {
        recipe = normalizeRecipe(JSON.parse(recipeJson));
      } catch (err) {
        recipe = {};
      }

      const recipeId = String(row[index.recipe_id] || recipe.recipe_id || "");
      if (recipe && !recipe.recipe_id) recipe.recipe_id = recipeId;

      return {
        recipe_id: recipeId,
        version: Number(row[index.version] || 0),
        title: String(row[index.title] || recipe.title || ""),
        ingredients_text: String(row[index.ingredients_text] || ingredientsText(recipe)),
        tags: String(row[index.tags] || (recipe.tags || []).join(",")),
        mood_tags: String(row[index.mood_tags] || (recipe.mood_tags || []).join(",")),
        image_file_id: String(row[index.image_file_id] || ""),
        recipe_json: recipeJson,
        recipe: recipe,
        created_at: row[index.created_at]
      };
    });
}

function publicRecord(record, includeRecipe) {
  const result = {
    recipe_id: record.recipe_id,
    version: record.version,
    title: record.title,
    ingredients_text: record.ingredients_text,
    tags: record.tags,
    mood_tags: record.mood_tags,
    image_file_id: record.image_file_id,
    image_url: imageUrl(record.image_file_id),
    created_at: record.created_at
  };
  if (includeRecipe) result.recipe = record.recipe;
  return result;
}

function savePhoto(photo, recipeId, version) {
  const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) throw new Error("DRIVE_FOLDER_IDが未設定です。");

  const match = String(photo.dataUrl || "").match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("写真データの形式が不正です。");

  const mimeType = match[1];
  if (!/^image\//.test(mimeType)) throw new Error("写真ファイルのみアップロードできます。");

  const bytes = Utilities.base64Decode(match[2]);
  const maxBytes = 7 * 1024 * 1024;
  if (bytes.length > maxBytes) {
    throw new Error("写真が大きすぎます。7MB以下にしてください。");
  }

  const safeOriginalName = String(photo.name || "photo").replace(/[\\/:*?"<>|]/g, "_");
  const baseName = safeOriginalName.replace(/\.[^.]+$/, "");
  const name = recipeId + "_v" + version + "_" + baseName + "." + extensionFromMime(mimeType);

  const blob = Utilities.newBlob(bytes, mimeType, name);
  const file = DriveApp.getFolderById(folderId).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function normalizeRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return recipe;
  const normalized = Object.assign({}, recipe);

  if (normalized.schemaVersion && !normalized.schema_version) normalized.schema_version = normalized.schemaVersion;
  if (normalized.recipeId && !normalized.recipe_id) normalized.recipe_id = normalized.recipeId;
  if (normalized.moodTags && !normalized.mood_tags) normalized.mood_tags = normalized.moodTags;
  if (normalized.cookingTimeMinutes && !normalized.cooking_time) normalized.cooking_time = normalized.cookingTimeMinutes;
  if (normalized.memo && !normalized.notes) normalized.notes = normalized.memo;
  if (normalized.summary && !normalized.notes) normalized.notes = normalized.summary;

  if (!("recipe_id" in normalized)) normalized.recipe_id = null;
  if (!("servings" in normalized)) normalized.servings = "";
  if (!("tags" in normalized)) normalized.tags = [];
  if (!("mood_tags" in normalized)) normalized.mood_tags = [];
  if (!("cooking_time" in normalized)) normalized.cooking_time = "";
  if (!("notes" in normalized)) normalized.notes = "";
  if (!("improvements" in normalized)) normalized.improvements = "";

  return {
    schema_version: normalized.schema_version,
    recipe_id: normalized.recipe_id,
    title: normalized.title,
    servings: normalized.servings,
    ingredients: normalized.ingredients,
    steps: normalized.steps,
    tags: normalized.tags,
    mood_tags: normalized.mood_tags,
    cooking_time: normalized.cooking_time,
    notes: normalized.notes,
    improvements: normalized.improvements
  };
}

function validateRecipe(recipe) {
  const errors = [];

  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    throw new Error("recipeはオブジェクトである必要があります。");
  }

  if (!("schema_version" in recipe)) errors.push("schema_versionがありません。");
  if (recipe.schema_version !== SCHEMA_VERSION) errors.push("schema_versionは" + SCHEMA_VERSION + "である必要があります。");
  if (recipe.recipe_id !== null && recipe.recipe_id !== undefined && recipe.recipe_id !== "" && typeof recipe.recipe_id !== "string") errors.push("recipe_idは文字列、null、または省略である必要があります。");
  if (typeof recipe.title !== "string" || !recipe.title.trim()) errors.push("titleは空でない文字列である必要があります。");
  if (!Array.isArray(recipe.ingredients)) errors.push("ingredientsが配列ではありません。");
  if (!Array.isArray(recipe.steps)) errors.push("stepsが配列ではありません。");
  if (!Array.isArray(recipe.tags)) errors.push("tagsが配列ではありません。");
  if (!Array.isArray(recipe.mood_tags)) errors.push("mood_tagsが配列ではありません。");
  if (!["string", "number"].includes(typeof recipe.servings)) errors.push("servingsは文字列または数値である必要があります。");
  if (!["string", "number"].includes(typeof recipe.cooking_time)) errors.push("cooking_timeは文字列または数値である必要があります。");
  if (typeof recipe.notes !== "string") errors.push("notesは文字列である必要があります。");
  if (typeof recipe.improvements !== "string") errors.push("improvementsは文字列である必要があります。");

  if (Array.isArray(recipe.ingredients)) {
    if (recipe.ingredients.length === 0) errors.push("ingredientsは1件以上必要です。");
    recipe.ingredients.forEach(function (item, index) {
      const label = (index + 1) + "番目のingredient";
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(label + "はオブジェクトである必要があります。");
      } else {
        if (!("name" in item)) errors.push(label + "にnameがありません。");
        else if (typeof item.name !== "string" || !item.name.trim()) errors.push(label + "のnameは空でない文字列である必要があります。");
        if (!("amount" in item)) errors.push(label + "にamountがありません。");
        else if (typeof item.amount !== "string") errors.push(label + "のamountは文字列である必要があります。");
      }
    });
  }

  if (Array.isArray(recipe.steps)) {
    if (recipe.steps.length === 0) errors.push("stepsは1件以上必要です。");
    recipe.steps.forEach(function (step, index) {
      if (typeof step !== "string" || !step.trim()) errors.push((index + 1) + "番目のstepは空でない文字列である必要があります。");
    });
  }

  if (errors.length) throw new Error(errors.join(" / "));
}

function ingredientsText(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return "";
  return recipe.ingredients.map(function (item) {
    return String((item.name || "") + " " + (item.amount || "")).trim();
  }).join(" / ");
}

function latestRecord(records) {
  return records.slice().sort(function (a, b) {
    return b.version - a.version;
  })[0];
}

function getSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("SPREADSHEET_IDが未設定です。");

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }

  const existing = getHeaders(sheet);
  HEADERS.forEach(function (header) {
    if (existing.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existing.push(header);
    }
  });
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function (value) {
    return String(value);
  });
}

function imageUrl(fileId) {
  if (!fileId) return "";
  return "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(fileId);
}

function extensionFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif"
  };
  return map[mimeType] || "bin";
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
