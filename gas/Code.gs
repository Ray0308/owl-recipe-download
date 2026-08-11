const SCHEMA_VERSION = 1;
const RECIPE_SHEET_NAME = "recipes";
const RESTAURANT_SHEET_NAME = "restaurants";
const RECIPE_USER_META_SHEET_NAME = "recipe_user_meta";
const RESTAURANT_USER_META_SHEET_NAME = "restaurant_user_meta";
const SAVE_RECEIPT_SHEET_NAME = "save_receipts";

const RECIPE_HEADERS = [
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
const RESTAURANT_HEADERS = [
  "restaurant_id",
  "name",
  "phone",
  "address",
  "url",
  "area",
  "genres",
  "tags",
  "mood_tags",
  "image_file_id",
  "restaurant_json",
  "created_at"
];
const RECIPE_USER_META_HEADERS = [
  "recipe_id",
  "favorite",
  "last_cooked_at",
  "cooked_count",
  "archived",
  "updated_at"
];
const RESTAURANT_USER_META_HEADERS = [
  "restaurant_id",
  "favorite",
  "want_to_visit",
  "visited",
  "want_to_revisit",
  "last_visited_at",
  "visit_count",
  "archived",
  "updated_at"
];
const SAVE_RECEIPT_HEADERS = [
  "request_token",
  "ok",
  "payload_json",
  "created_at"
];

// Script Properties:
// SPREADSHEET_ID: Google Sheets "Recipe DB" のID
// DRIVE_FOLDER_ID: Google Drive "Recipe Photos" フォルダのID

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "");

    if (action === "listRecipes") {
      return jsonResponse({ ok: true, items: listLatestRecipes() });
    }

    if (action === "getRecipe") {
      const recipeId = e.parameter.recipe_id || e.parameter.recipeId || "";
      const version = e.parameter.version ? Number(e.parameter.version) : null;
      return jsonResponse(getRecipe(recipeId, version));
    }

    if (action === "toggleRecipeFavorite") {
      const recipeId = e.parameter.recipe_id || e.parameter.recipeId || "";
      return jsonResponse({ ok: true, meta: toggleRecipeFavorite(recipeId) });
    }

    if (action === "recordRecipeCook") {
      const recipeId = e.parameter.recipe_id || e.parameter.recipeId || "";
      return jsonResponse({ ok: true, meta: recordRecipeCook(recipeId) });
    }

    if (action === "getSaveReceipt") {
      const requestToken = e.parameter.request_token || e.parameter.requestToken || "";
      return jsonResponse(getSaveReceipt(requestToken));
    }

    if (action === "archiveRecipe") {
      const recipeId = e.parameter.recipe_id || e.parameter.recipeId || "";
      return jsonResponse({ ok: true, meta: setRecipeArchived(recipeId, true) });
    }

    if (action === "restoreRecipe") {
      const recipeId = e.parameter.recipe_id || e.parameter.recipeId || "";
      return jsonResponse({ ok: true, meta: setRecipeArchived(recipeId, false) });
    }

    if (action === "listRestaurants") {
      return jsonResponse({ ok: true, items: listRestaurants() });
    }

    if (action === "getRestaurant") {
      const restaurantId = e.parameter.restaurant_id || e.parameter.restaurantId || "";
      return jsonResponse(getRestaurant(restaurantId));
    }

    if (action === "toggleRestaurantFavorite") {
      const restaurantId = e.parameter.restaurant_id || e.parameter.restaurantId || "";
      return jsonResponse({ ok: true, meta: toggleRestaurantFavorite(restaurantId) });
    }

    if (action === "setRestaurantStatus") {
      const restaurantId = e.parameter.restaurant_id || e.parameter.restaurantId || "";
      const status = e.parameter.status || "";
      return jsonResponse({ ok: true, meta: setRestaurantStatus(restaurantId, status) });
    }

    if (action === "recordRestaurantVisit") {
      const restaurantId = e.parameter.restaurant_id || e.parameter.restaurantId || "";
      return jsonResponse({ ok: true, meta: recordRestaurantVisit(restaurantId) });
    }

    if (action === "archiveRestaurant") {
      const restaurantId = e.parameter.restaurant_id || e.parameter.restaurantId || "";
      return jsonResponse({ ok: true, meta: setRestaurantArchived(restaurantId, true) });
    }

    if (action === "restoreRestaurant") {
      const restaurantId = e.parameter.restaurant_id || e.parameter.restaurantId || "";
      return jsonResponse({ ok: true, meta: setRestaurantArchived(restaurantId, false) });
    }

    return jsonResponse({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  const responseMode = String((e && e.parameter && e.parameter.response_mode) || "");
  const requestToken = String((e && e.parameter && e.parameter.request_token) || "");
  const returnUrl = String((e && e.parameter && e.parameter.return_url) || "");

  try {
    const payload = parsePostPayload(e);
    let result = { ok: false, error: "Unknown action." };

    if (payload.action === "saveRecipe") {
      result = Object.assign({ ok: true }, saveRecipe(payload.recipe, payload.photo));
    }

    if (payload.action === "saveRestaurant") {
      result = Object.assign({ ok: true }, saveRestaurant(payload.restaurant, payload.photo));
    }

    if (requestToken) writeSaveReceipt(requestToken, result);
    if (responseMode === "htmlRedirect") return redirectResponse(result, returnUrl);
    if (responseMode === "postMessage") return postMessageResponse(result, requestToken);
    return jsonResponse(result);
  } catch (err) {
    const result = { ok: false, error: String(err.message || err) };
    if (requestToken) writeSaveReceipt(requestToken, result);
    if (responseMode === "htmlRedirect") return redirectResponse(result, returnUrl);
    if (responseMode === "postMessage") return postMessageResponse(result, requestToken);
    return jsonResponse(result);
  }
}

function parsePostPayload(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  return JSON.parse((e && e.postData && e.postData.contents) || "{}");
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
  ensureRecipeUserMeta(recipeId);

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

  const metaById = readRecipeUserMetaById();
  return Object.keys(latest)
    .map(function (key) {
      const meta = metaById[key] || defaultRecipeMeta(key);
      if (toBoolean(meta.archived)) return null;
      return publicRecord(latest[key], false, meta);
    })
    .filter(function (item) {
      return item;
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
    item: publicRecord(selected, true, readRecipeUserMetaById()[recipeId] || defaultRecipeMeta(recipeId)),
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

function toggleRecipeFavorite(recipeId) {
  const meta = getExistingRecipeMeta(recipeId);
  meta.favorite = !toBoolean(meta.favorite);
  meta.updated_at = new Date();
  writeRecipeMeta(meta);
  return meta;
}

function recordRecipeCook(recipeId) {
  const meta = getExistingRecipeMeta(recipeId);
  meta.last_cooked_at = new Date();
  meta.cooked_count = Number(meta.cooked_count || 0) + 1;
  meta.updated_at = new Date();
  writeRecipeMeta(meta);
  return meta;
}

function setRecipeArchived(recipeId, archived) {
  const meta = getExistingRecipeMeta(recipeId);
  meta.archived = Boolean(archived);
  meta.updated_at = new Date();
  writeRecipeMeta(meta);
  return meta;
}

function saveRestaurant(inputRestaurant, photo) {
  const restaurant = normalizeRestaurant(inputRestaurant);
  validateRestaurant(restaurant);

  const sheet = getRestaurantSheet();
  ensureHeader(sheet, RESTAURANT_HEADERS);
  const records = readRestaurantRecords(sheet);

  const suppliedRestaurantId = restaurant.restaurant_id || "";
  let restaurantId = suppliedRestaurantId;
  let imageFileId = "";

  if (suppliedRestaurantId) {
    const existing = records.filter(function (record) {
      return record.restaurant_id === suppliedRestaurantId;
    });
    if (existing.length === 0) {
      throw new Error("指定されたrestaurant_idの既存店舗が見つかりません: " + suppliedRestaurantId);
    }
    imageFileId = existing[existing.length - 1].image_file_id || "";
  } else {
    restaurantId = Utilities.getUuid();
    restaurant.restaurant_id = restaurantId;
  }

  if (photo && photo.dataUrl) {
    imageFileId = savePhoto(photo, restaurantId, "restaurant");
  }

  const record = {
    restaurant_id: restaurantId,
    name: restaurant.name,
    phone: restaurant.phone,
    address: restaurant.address,
    url: restaurant.url,
    area: restaurant.area,
    genres: restaurant.genres.join(","),
    tags: restaurant.tags.join(","),
    mood_tags: restaurant.mood_tags.join(","),
    image_file_id: imageFileId,
    restaurant_json: JSON.stringify(restaurant),
    created_at: new Date()
  };

  appendRecord(sheet, record);
  ensureRestaurantUserMeta(restaurantId, restaurant.status);

  return {
    restaurant_id: restaurantId,
    image_file_id: imageFileId,
    image_url: imageUrl(imageFileId)
  };
}

function listRestaurants() {
  const sheet = getRestaurantSheet();
  ensureHeader(sheet, RESTAURANT_HEADERS);

  const latest = {};
  readRestaurantRecords(sheet).forEach(function (record) {
    if (!latest[record.restaurant_id] || new Date(latest[record.restaurant_id].created_at).getTime() < new Date(record.created_at).getTime()) {
      latest[record.restaurant_id] = record;
    }
  });

  const metaById = readRestaurantUserMetaById();
  return Object.keys(latest)
    .map(function (key) {
      const meta = metaById[key] || defaultRestaurantMeta(key, latest[key].restaurant && latest[key].restaurant.status);
      if (toBoolean(meta.archived)) return null;
      return publicRestaurantRecord(latest[key], false, meta);
    })
    .filter(function (item) {
      return item;
    })
    .sort(function (a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function getRestaurant(restaurantId) {
  if (!restaurantId) throw new Error("restaurant_id is required.");

  const sheet = getRestaurantSheet();
  ensureHeader(sheet, RESTAURANT_HEADERS);

  const records = readRestaurantRecords(sheet)
    .filter(function (record) {
      return record.restaurant_id === restaurantId;
    })
    .sort(function (a, b) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  if (records.length === 0) {
    return { ok: false, error: "飲食店が見つかりません。" };
  }

  const selected = records[records.length - 1];
  const meta = readRestaurantUserMetaById()[restaurantId] || defaultRestaurantMeta(restaurantId, selected.restaurant.status);

  return {
    ok: true,
    item: publicRestaurantRecord(selected, true, meta)
  };
}

function toggleRestaurantFavorite(restaurantId) {
  const meta = getExistingRestaurantMeta(restaurantId);
  meta.favorite = !toBoolean(meta.favorite);
  meta.updated_at = new Date();
  writeRestaurantMeta(meta);
  return meta;
}

function setRestaurantStatus(restaurantId, status) {
  if (["want_to_visit", "visited", "want_to_revisit"].indexOf(status) === -1) {
    throw new Error("statusが不正です。");
  }
  const meta = getExistingRestaurantMeta(restaurantId);
  meta.want_to_visit = status === "want_to_visit";
  meta.visited = status === "visited" || status === "want_to_revisit";
  meta.want_to_revisit = status === "want_to_revisit";
  meta.updated_at = new Date();
  writeRestaurantMeta(meta);
  return meta;
}

function recordRestaurantVisit(restaurantId) {
  const meta = getExistingRestaurantMeta(restaurantId);
  meta.visited = true;
  meta.want_to_visit = false;
  meta.last_visited_at = new Date();
  meta.visit_count = Number(meta.visit_count || 0) + 1;
  meta.updated_at = new Date();
  writeRestaurantMeta(meta);
  return meta;
}

function setRestaurantArchived(restaurantId, archived) {
  const meta = getExistingRestaurantMeta(restaurantId);
  meta.archived = Boolean(archived);
  meta.updated_at = new Date();
  writeRestaurantMeta(meta);
  return meta;
}

function writeSaveReceipt(requestToken, payload) {
  if (!requestToken) return;
  const sheet = getSaveReceiptSheet();
  ensureHeader(sheet, SAVE_RECEIPT_HEADERS);
  appendRecord(sheet, {
    request_token: requestToken,
    ok: Boolean(payload && payload.ok),
    payload_json: JSON.stringify(payload || {}),
    created_at: new Date()
  });
}

function getSaveReceipt(requestToken) {
  if (!requestToken) return { ok: false, pending: true, error: "request_token is required." };
  const sheet = getSaveReceiptSheet();
  ensureHeader(sheet, SAVE_RECEIPT_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { ok: false, pending: true };

  const headers = values[0].map(function (value) {
    return String(value);
  });
  const index = {};
  headers.forEach(function (header, i) {
    index[header] = i;
  });

  for (let i = values.length - 1; i >= 1; i -= 1) {
    const row = values[i];
    if (String(row[index.request_token] || "") !== requestToken) continue;
    try {
      return JSON.parse(String(row[index.payload_json] || "{}"));
    } catch (err) {
      return { ok: false, error: "Saved receipt could not be parsed." };
    }
  }

  return { ok: false, pending: true };
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

function readRestaurantRecords(sheet) {
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
      return row[index.restaurant_id] !== "";
    })
    .map(function (row) {
      const restaurantJson = String(row[index.restaurant_json] || "{}");
      let restaurant = {};
      try {
        restaurant = normalizeRestaurant(JSON.parse(restaurantJson));
      } catch (err) {
        restaurant = {};
      }

      const restaurantId = String(row[index.restaurant_id] || restaurant.restaurant_id || "");
      if (restaurant && !restaurant.restaurant_id) restaurant.restaurant_id = restaurantId;

      return {
        restaurant_id: restaurantId,
        name: String(row[index.name] || restaurant.name || ""),
        phone: String(row[index.phone] || restaurant.phone || ""),
        address: String(row[index.address] || restaurant.address || ""),
        url: String(row[index.url] || restaurant.url || ""),
        area: String(row[index.area] || restaurant.area || ""),
        genres: String(row[index.genres] || (restaurant.genres || []).join(",")),
        tags: String(row[index.tags] || (restaurant.tags || []).join(",")),
        mood_tags: String(row[index.mood_tags] || (restaurant.mood_tags || []).join(",")),
        image_file_id: String(row[index.image_file_id] || ""),
        restaurant_json: restaurantJson,
        restaurant: restaurant,
        created_at: row[index.created_at]
      };
    });
}

function publicRecord(record, includeRecipe, meta) {
  const result = {
    recipe_id: record.recipe_id,
    version: record.version,
    title: record.title,
    ingredients_text: record.ingredients_text,
    tags: record.tags,
    mood_tags: record.mood_tags,
    image_file_id: record.image_file_id,
    image_url: imageUrl(record.image_file_id),
    created_at: record.created_at,
    meta: meta || defaultRecipeMeta(record.recipe_id)
  };
  if (includeRecipe) result.recipe = record.recipe;
  return result;
}

function ensureRecipeUserMeta(recipeId) {
  const sheet = getRecipeUserMetaSheet();
  ensureHeader(sheet, RECIPE_USER_META_HEADERS);
  const metaById = readRecipeUserMetaById();
  if (metaById[recipeId]) return metaById[recipeId];

  const meta = defaultRecipeMeta(recipeId);
  meta.updated_at = new Date();
  appendRecord(sheet, meta);
  return meta;
}

function getExistingRecipeMeta(recipeId) {
  if (!recipeId) throw new Error("recipe_id is required.");
  const recipes = readRecords(getSheet()).filter(function (record) {
    return record.recipe_id === recipeId;
  });
  if (recipes.length === 0) throw new Error("レシピが見つかりません。");
  return readRecipeUserMetaById()[recipeId] || ensureRecipeUserMeta(recipeId);
}

function writeRecipeMeta(meta) {
  const sheet = getRecipeUserMetaSheet();
  ensureHeader(sheet, RECIPE_USER_META_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = getHeaders(sheet);
  const recipeIdIndex = headers.indexOf("recipe_id");

  let targetRow = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][recipeIdIndex] || "") === meta.recipe_id) {
      targetRow = i + 1;
      break;
    }
  }

  const row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(meta, header) ? meta[header] : "";
  });

  if (targetRow === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }
}

function readRecipeUserMetaById() {
  const sheet = getRecipeUserMetaSheet();
  ensureHeader(sheet, RECIPE_USER_META_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};

  const headers = values[0].map(function (value) {
    return String(value);
  });
  const index = {};
  headers.forEach(function (header, i) {
    index[header] = i;
  });

  const result = {};
  values.slice(1).forEach(function (row) {
    const recipeId = String(row[index.recipe_id] || "");
    if (!recipeId) return;
    result[recipeId] = {
      recipe_id: recipeId,
      favorite: toBoolean(row[index.favorite]),
      last_cooked_at: row[index.last_cooked_at] || "",
      cooked_count: Number(row[index.cooked_count] || 0),
      archived: toBoolean(row[index.archived]),
      updated_at: row[index.updated_at] || ""
    };
  });
  return result;
}

function defaultRecipeMeta(recipeId) {
  return {
    recipe_id: recipeId,
    favorite: false,
    last_cooked_at: "",
    cooked_count: 0,
    archived: false,
    updated_at: ""
  };
}

function publicRestaurantRecord(record, includeRestaurant, meta) {
  const result = {
    restaurant_id: record.restaurant_id,
    name: record.name,
    phone: record.phone,
    address: record.address,
    url: record.url,
    area: record.area,
    genres: record.genres,
    tags: record.tags,
    mood_tags: record.mood_tags,
    image_file_id: record.image_file_id,
    image_url: imageUrl(record.image_file_id),
    created_at: record.created_at,
    meta: meta || defaultRestaurantMeta(record.restaurant_id, record.restaurant && record.restaurant.status)
  };
  if (includeRestaurant) result.restaurant = record.restaurant;
  return result;
}

function ensureRestaurantUserMeta(restaurantId, status) {
  const sheet = getRestaurantUserMetaSheet();
  ensureHeader(sheet, RESTAURANT_USER_META_HEADERS);
  const metaById = readRestaurantUserMetaById();
  if (metaById[restaurantId]) return metaById[restaurantId];

  const meta = defaultRestaurantMeta(restaurantId, status);
  meta.updated_at = new Date();
  appendRecord(sheet, meta);
  return meta;
}

function getExistingRestaurantMeta(restaurantId) {
  if (!restaurantId) throw new Error("restaurant_id is required.");
  const restaurants = readRestaurantRecords(getRestaurantSheet()).filter(function (record) {
    return record.restaurant_id === restaurantId;
  });
  if (restaurants.length === 0) throw new Error("飲食店が見つかりません。");
  const metaById = readRestaurantUserMetaById();
  return metaById[restaurantId] || ensureRestaurantUserMeta(restaurantId, restaurants[restaurants.length - 1].restaurant.status);
}

function writeRestaurantMeta(meta) {
  const sheet = getRestaurantUserMetaSheet();
  ensureHeader(sheet, RESTAURANT_USER_META_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = getHeaders(sheet);
  const restaurantIdIndex = headers.indexOf("restaurant_id");

  let targetRow = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][restaurantIdIndex] || "") === meta.restaurant_id) {
      targetRow = i + 1;
      break;
    }
  }

  const row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(meta, header) ? meta[header] : "";
  });

  if (targetRow === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }
}

function readRestaurantUserMetaById() {
  const sheet = getRestaurantUserMetaSheet();
  ensureHeader(sheet, RESTAURANT_USER_META_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};

  const headers = values[0].map(function (value) {
    return String(value);
  });
  const index = {};
  headers.forEach(function (header, i) {
    index[header] = i;
  });

  const result = {};
  values.slice(1).forEach(function (row) {
    const restaurantId = String(row[index.restaurant_id] || "");
    if (!restaurantId) return;
    result[restaurantId] = {
      restaurant_id: restaurantId,
      favorite: toBoolean(row[index.favorite]),
      want_to_visit: toBoolean(row[index.want_to_visit]),
      visited: toBoolean(row[index.visited]),
      want_to_revisit: toBoolean(row[index.want_to_revisit]),
      last_visited_at: row[index.last_visited_at] || "",
      visit_count: Number(row[index.visit_count] || 0),
      archived: toBoolean(row[index.archived]),
      updated_at: row[index.updated_at] || ""
    };
  });
  return result;
}

function defaultRestaurantMeta(restaurantId, status) {
  const normalizedStatus = String(status || "want_to_visit");
  return {
    restaurant_id: restaurantId,
    favorite: false,
    want_to_visit: normalizedStatus === "want_to_visit",
    visited: normalizedStatus === "visited" || normalizedStatus === "want_to_revisit",
    want_to_revisit: normalizedStatus === "want_to_revisit",
    last_visited_at: "",
    visit_count: 0,
    archived: false,
    updated_at: ""
  };
}

function toBoolean(value) {
  if (value === true) return true;
  const text = String(value || "").toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function savePhoto(photo, contentId, versionLabel) {
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
  const versionPart = versionLabel === "restaurant" ? "_restaurant" : "_v" + versionLabel;
  const name = contentId + versionPart + "_" + baseName + "." + extensionFromMime(mimeType);

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

function normalizeRestaurant(restaurant) {
  if (!restaurant || typeof restaurant !== "object") return restaurant;
  const normalized = Object.assign({}, restaurant);

  if (normalized.schemaVersion && !normalized.schema_version) normalized.schema_version = normalized.schemaVersion;
  if (normalized.restaurantId && !normalized.restaurant_id) normalized.restaurant_id = normalized.restaurantId;
  if (normalized.genre && !normalized.genres) normalized.genres = [normalized.genre];
  if (normalized.moodTags && !normalized.mood_tags) normalized.mood_tags = normalized.moodTags;

  if (!("type" in normalized)) normalized.type = "restaurant";
  if (!("restaurant_id" in normalized)) normalized.restaurant_id = null;
  if (!("phone" in normalized)) normalized.phone = "";
  if (!("address" in normalized)) normalized.address = "";
  if (!("url" in normalized)) normalized.url = "";
  if (!("area" in normalized)) normalized.area = "";
  if (!("genres" in normalized)) normalized.genres = [];
  if (!("tags" in normalized)) normalized.tags = [];
  if (!("mood_tags" in normalized)) normalized.mood_tags = [];
  if (!("notes" in normalized)) normalized.notes = "";
  if (!("status" in normalized)) normalized.status = "want_to_visit";

  return {
    schema_version: normalized.schema_version,
    type: normalized.type,
    restaurant_id: normalized.restaurant_id,
    name: normalized.name,
    phone: normalized.phone,
    address: normalized.address,
    url: normalized.url,
    area: normalized.area,
    genres: normalized.genres,
    tags: normalized.tags,
    mood_tags: normalized.mood_tags,
    notes: normalized.notes,
    status: normalized.status
  };
}

function validateRecipe(recipe) {
  const errors = [];

  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    throw new Error("recipeはオブジェクトである必要があります。");
  }

  if (!("schema_version" in recipe)) errors.push("schema_versionがありません。");
  if (recipe.schema_version !== SCHEMA_VERSION) errors.push("schema_versionは" + SCHEMA_VERSION + "である必要があります。");
  if (recipe.recipe_id !== null && recipe.recipe_id !== undefined && recipe.recipe_id !== "" && typeof recipe.recipe_id !== "string") errors.push("recipe_idは文字列、null、または空である必要があります。");
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

function validateRestaurant(restaurant) {
  const errors = [];

  if (!restaurant || typeof restaurant !== "object" || Array.isArray(restaurant)) {
    throw new Error("restaurantはオブジェクトである必要があります。");
  }

  if (!("schema_version" in restaurant)) errors.push("schema_versionがありません。");
  if (restaurant.schema_version !== SCHEMA_VERSION) errors.push("schema_versionは" + SCHEMA_VERSION + "である必要があります。");
  if (restaurant.type !== "restaurant") errors.push("typeはrestaurantである必要があります。");
  if (restaurant.restaurant_id !== null && restaurant.restaurant_id !== undefined && restaurant.restaurant_id !== "" && typeof restaurant.restaurant_id !== "string") errors.push("restaurant_idは文字列、null、または空である必要があります。");
  if (typeof restaurant.name !== "string" || !restaurant.name.trim()) errors.push("nameは空でない文字列である必要があります。");
  if (typeof restaurant.phone !== "string") errors.push("phoneは文字列である必要があります。");
  if (typeof restaurant.address !== "string") errors.push("addressは文字列である必要があります。");
  if (typeof restaurant.url !== "string") errors.push("urlは文字列である必要があります。");
  if (typeof restaurant.area !== "string") errors.push("areaは文字列である必要があります。");
  if (!Array.isArray(restaurant.genres)) errors.push("genresが配列ではありません。");
  if (!Array.isArray(restaurant.tags)) errors.push("tagsが配列ではありません。");
  if (!Array.isArray(restaurant.mood_tags)) errors.push("mood_tagsが配列ではありません。");
  if (typeof restaurant.notes !== "string") errors.push("notesは文字列である必要があります。");
  if (["want_to_visit", "visited", "want_to_revisit"].indexOf(restaurant.status) === -1) {
    errors.push("statusはwant_to_visit、visited、want_to_revisitのいずれかである必要があります。");
  }

  validateStringArrayForGas(restaurant.genres, "genres", errors);
  validateStringArrayForGas(restaurant.tags, "tags", errors);
  validateStringArrayForGas(restaurant.mood_tags, "mood_tags", errors);

  if (errors.length) throw new Error(errors.join(" / "));
}

function validateStringArrayForGas(value, key, errors) {
  if (!Array.isArray(value)) return;
  value.forEach(function (item, index) {
    if (typeof item !== "string") errors.push(key + "の" + (index + 1) + "番目は文字列である必要があります。");
  });
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
  return getSheetByName(RECIPE_SHEET_NAME);
}

function getRestaurantSheet() {
  return getSheetByName(RESTAURANT_SHEET_NAME);
}

function getRecipeUserMetaSheet() {
  return getSheetByName(RECIPE_USER_META_SHEET_NAME);
}

function getRestaurantUserMetaSheet() {
  return getSheetByName(RESTAURANT_USER_META_SHEET_NAME);
}

function getSaveReceiptSheet() {
  return getSheetByName(SAVE_RECEIPT_SHEET_NAME);
}

function getSheetByName(sheetName) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("SPREADSHEET_IDが未設定です。");

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  return sheet;
}

function ensureHeader(sheet, expectedHeaders) {
  const headersToUse = expectedHeaders || RECIPE_HEADERS;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headersToUse);
    return;
  }

  const existing = getHeaders(sheet);
  headersToUse.forEach(function (header) {
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

function redirectResponse(result, returnUrl) {
  const target = buildReturnUrl(returnUrl, result);
  const safeTarget = escapeHtml(target);
  const title = result.ok ? "保存しました" : "保存に失敗しました";
  const message = result.ok
    ? "保存しました。アプリへ戻ります。"
    : "保存に失敗しました。アプリへ戻ります。";

  const html = [
    "<!doctype html>",
    "<html lang=\"ja\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "<title>" + escapeHtml(title) + "</title>",
    "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;line-height:1.7;background:#f7f3ea;color:#1f2933}a{color:#1864ab}</style>",
    "</head>",
    "<body>",
    "<p>" + escapeHtml(message) + "</p>",
    "<p><a href=\"" + safeTarget + "\">アプリへ戻る</a></p>",
    "<script>window.setTimeout(function(){location.replace(" + JSON.stringify(target) + ");}, 300);</script>",
    "</body>",
    "</html>"
  ].join("");

  return HtmlService.createHtmlOutput(html);
}

function buildReturnUrl(returnUrl, result) {
  const fallback = "https://ray0308.github.io/owl-recipe-download/";
  let url = String(returnUrl || fallback);
  if (!/^https?:\/\//i.test(url)) url = fallback;

  const separator = url.indexOf("?") === -1 ? "?" : "&";
  if (result.ok) {
    const params = [
      "saved=1",
      "recipe_id=" + encodeURIComponent(result.recipe_id || ""),
      "restaurant_id=" + encodeURIComponent(result.restaurant_id || ""),
      "version=" + encodeURIComponent(result.version || "")
    ];
    return url + separator + params.join("&");
  }
  return url + separator + "save_error=" + encodeURIComponent(result.error || "保存に失敗しました。");
}

function postMessageResponse(payload, requestToken) {
  const message = {
    source: "food-platform-gas",
    request_token: requestToken,
    payload: payload
  };
  const html = [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"></head><body>",
    "<script>",
    "window.parent.postMessage(" + JSON.stringify(message) + ", '*');",
    "</script>",
    "</body></html>"
  ].join("");

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
