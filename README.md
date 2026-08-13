# Food Platform

Food Platformは、個人で作った料理・レシピ、行きたい店、また行きたい店を簡単に保存、検索、改善していくためのWebアプリです。

目的は「登録が面倒で使わなくなる」ことを防ぐことです。料理名、材料、手順、タグなどはユーザーがフォーム入力せず、普段利用しているChatGPT Plusで整理した保存用JSONを貼り付けて保存します。

このアプリは個人用のレシピ管理ツールです。

## 基本方針

- OpenAI APIは使用しない
- ChatGPT Plusを手動で利用する
- ChatGPTが出力したJSONをアプリへ貼り付ける
- レシピはGoogle Sheetsへ保存する
- 登録はJSON貼り付けを中心にする
- フロントエンドはGitHub Pagesで公開する
- 外部有料サービスは追加しない

## 基本運用

新規レシピ:

1. ChatGPTで料理・レシピについて相談する
2. 完成したレシピを保存用JSONに整形する
3. JSONをクリップボードへコピーする
4. Food Platformを開く
5. JSONを貼り付ける
6. プレビューを確認する
7. 保存する

既存レシピの改善:

1. アプリでレシピ詳細を開く
2. 「GPT相談用にコピー」を押す
3. ChatGPTへ貼り付ける
4. 改善内容を相談する
5. 新しい保存用JSONを生成する
6. アプリへ貼り付ける
7. 新バージョンとして保存する

## システム構成

- フロントエンド: GitHub Pages
- 使用技術: HTML / CSS / JavaScript
- バックエンド: Google Apps Script
- レシピ保存: Google Sheets
- 写真保存: 現在の標準UIでは使用しない
- AI: ChatGPT Plusを手動利用
- OpenAI API: 使用しない

## Google側リソース標準名称

Google Sheets:

- `Recipe DB`

Google Drive写真フォルダ:

- `Recipe Photos`

現在の標準UIでは写真アップロードを使わないため、Driveフォルダ設定は任意です。実際のIDは環境ごとに異なるため、ソースコードへ固定値は埋め込みません。GASのScript Propertiesで以下を設定します。

- `SPREADSHEET_ID`
- `DRIVE_FOLDER_ID` 任意

## 保存用JSON仕様

正式Schemaは `recipe-schema.json` です。サンプルは `recipe-schema-example.json` を参照してください。

最小構造:

```json
{
  "schema_version": 1,
  "recipe_id": null,
  "title": "",
  "servings": "",
  "ingredients": [
    {
      "name": "",
      "amount": ""
    }
  ],
  "steps": [],
  "tags": [],
  "mood_tags": [],
  "cooking_time": "",
  "notes": "",
  "improvements": ""
}
```

必須項目:

- `schema_version`
- `title`
- `ingredients`
- `steps`

型ルール:

- `ingredients` は配列
- `ingredients` の各要素は `name` と `amount` を持つ
- `steps` は配列
- `tags` は配列
- `mood_tags` は配列

分量が不明な場合、ChatGPTに勝手な分量を確定させないでください。不明な値は `amount: ""` のように空文字で扱います。写真だけから実際の使用量を推測して保存する設計にはしません。

## recipe_idとバージョン管理

新規レシピは `recipe_id` を `null` または省略します。保存時にGASが一意のIDを発行します。

既存レシピを改善する場合は、詳細画面の「GPT相談用にコピー」を使います。コピーされる文章に現在の `recipe_id` が含まれるため、ChatGPTが出力する新しいJSONでも同じ `recipe_id` を維持してください。

保存時の扱い:

- `recipe_id` がない: 新規レシピとしてVer.1を作成
- `recipe_id` が既存: 同じレシピの新バージョンとして保存
- `recipe_id` が存在しないID: エラー

同じ料理名でも別レシピとして保存できます。料理名だけで同一レシピ判定はしません。

## ChatGPT保存用プロンプト

アプリ内の「GPT用プロンプトをコピー」を押すと、JSON Schemaを含む固定プロンプトがクリップボードへコピーされます。

同じ内容は `gpt-save-prompt.txt` にも保存しています。

このプロンプトをChatGPTへ貼り付ければ、毎回同じ形式の保存用JSONを生成できます。

## レシピ登録画面

登録画面は以下だけです。

- GPT出力JSON貼り付け欄
- クリップボードから貼り付け
- プレビュー
- 保存

料理名、材料、手順、タグなどをユーザーが再入力する必要はありません。

## プレビュー

保存前にJSONを人間向け表示へ変換します。

表示項目:

- 料理名
- 人数
- 調理時間
- 材料
- 作り方
- タグ
- 気分タグ
- メモ
- 次回改善点

## Google Sheets保存

レシピ本体はJSONとして保存します。同時に検索用データを別列へ展開します。

保存列:

- `recipe_id`
- `version`
- `title`
- `ingredients_text`
- `tags`
- `mood_tags`
- `image_file_id`
- `recipe_json`
- `created_at`

Phase 3以降では、飲食店管理のために以下のシートも使用します。GASが必要時に自動作成します。

- `restaurants`
- `recipe_user_meta`
- `restaurant_user_meta`

`restaurants` の保存列:

- `restaurant_id`
- `name`
- `phone`
- `address`
- `url`
- `area`
- `genres`
- `tags`
- `mood_tags`
- `image_file_id`
- `restaurant_json`
- `created_at`

`recipe_user_meta` の保存列:

- `recipe_id`
- `favorite`
- `last_cooked_at`
- `cooked_count`
- `updated_at`

`restaurant_user_meta` の保存列:

- `restaurant_id`
- `favorite`
- `want_to_visit`
- `visited`
- `want_to_revisit`
- `last_visited_at`
- `visit_count`
- `updated_at`

## Restaurant JSON仕様

正式Schemaは `restaurant-schema.json` です。サンプルは `restaurant-schema-example.json` を参照してください。

最小構造:

```json
{
  "schema_version": 1,
  "type": "restaurant",
  "restaurant_id": null,
  "name": "",
  "phone": "",
  "address": "",
  "url": "",
  "area": "",
  "genres": [],
  "tags": [],
  "mood_tags": [],
  "notes": "",
  "status": "want_to_visit"
}
```

必須項目:

- `schema_version`
- `type`
- `name`

`restaurant_id` は店名から自動判定しません。新規店舗は `null` または省略し、保存時にGASが一意IDを発行します。

Recipe / Restaurant API:

- `GET ?action=toggleRecipeFavorite&recipe_id=...`
- `GET ?action=recordRecipeCook&recipe_id=...`
- `GET ?action=listRestaurants`
- `GET ?action=getRestaurant&restaurant_id=...`
- `POST action=saveRestaurant`
- `GET ?action=toggleRestaurantFavorite&restaurant_id=...`
- `GET ?action=setRestaurantStatus&restaurant_id=...&status=want_to_visit`
- `GET ?action=recordRestaurantVisit&restaurant_id=...`

## 飲食店管理

飲食店もレシピと同じく、ChatGPT Plusで保存用JSONを作り、アプリに貼り付けて保存します。

登録フロー:

1. 下部ナビの `＋` を押す
2. `飲食店` を選ぶ
3. Restaurant JSONを貼り付ける
4. プレビューを確認する
5. 保存する

お店詳細では以下を1タップで更新できます。

- 行きたい
- また行きたい
- お気に入り
- 今日行った

## 利用履歴

レシピ詳細では以下を1タップで更新できます。

- 今日作った
- お気に入り

`今日作った` を押すと `last_cooked_at` が当日になり、`cooked_count` が1増えます。レシピ自体は上書きせず、利用履歴は `recipe_user_meta` に分けて保存します。

飲食店詳細では `今日行った` を押すと `last_visited_at` が当日になり、`visit_count` が1増え、`visited` が `true` になります。

## 横断検索と候補表示

ホーム上部の検索はRecipeとRestaurantをまとめて検索します。

Recipe検索対象:

- 料理名
- 材料
- 通常タグ
- 気分タグ
- お気に入り

Restaurant検索対象:

- 店名
- エリア
- ジャンル
- 通常タグ
- 気分タグ
- 行きたい / 行った / また行きたい / お気に入り

検索欄の下にあるタグチップはAND条件で絞り込みます。

`今日何食べる？` はAI APIを使わず、保存済みデータから条件に近い候補を数件表示します。

## 調理モード

レシピ詳細の `調理モード` を押すと、手順を1工程ずつ大きく表示します。対応ブラウザでは画面スリープ防止を試みます。

## PWA

`manifest.webmanifest` と `sw.js` を含めています。GitHub PagesをiPhone Safariで開き、共有メニューから `ホーム画面に追加` するとWebアプリ風に起動できます。

## 写真保存

現在の標準UIでは、登録負荷を下げるため写真アップロードは表示していません。GAS側にはDrive保存処理が残っていますが、通常の保存リクエストでは写真データを送信しません。

## 検索

以下を対象に検索します。

- 料理名
- 食材
- 通常タグ
- 気分タグ

複数語をスペース区切りで入力できます。

例:

- `鶏肉`
- `パスタ`
- `さっぱり`
- `がっつり`
- `簡単`

## タグ

通常タグ例:

- パスタ
- 肉料理
- 魚料理
- ソース
- イタリア
- スペイン
- 朝食
- 夕食
- 作り置き

気分タグ例:

- がっつり
- さっぱり
- あっさり
- 簡単
- 温かい
- 冷たい
- 酒に合う
- 手間をかけてもいい

タグはChatGPT側でJSONへ付与します。

## Google Apps Script導入

1. Google Sheetsで `Recipe DB` を作成する
2. Apps Scriptプロジェクトを作成する
3. `gas/Code.gs` の内容を貼り付ける
4. Apps ScriptのScript Propertiesへ以下を設定する
   - `SPREADSHEET_ID`: `Recipe DB` のSpreadsheet ID
   - `DRIVE_FOLDER_ID`: 任意。写真アップロードを再利用する場合のみ設定
5. Webアプリとしてデプロイする
   - 実行ユーザー: 自分
   - アクセスできるユーザー: 全員
7. 初回実行時にGoogleの権限許可を行う
8. 発行されたWeb App URLを控える

## フロントエンド設定

`config.js` にGAS Web App URLを設定します。

```js
window.APP_CONFIG = {
  GAS_ENDPOINT: "https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec"
};
```

## GitHub Pages公開

1. GitHubリポジトリを作成する
2. このリポジトリ直下にある `index.html` をGitHub Pagesで公開する
3. GitHub Pagesを有効化する
4. iPhone SafariでGitHub Pages URLを開く
5. 共有メニューから「ホーム画面に追加」する

## セキュリティ上の注意

このMVPは個人利用・URLを公開しない前提です。GAS Web Appを「全員」に公開するため、URLを知っている人はアクセスできる可能性があります。

今回の範囲ではユーザー認証や課金、外部AI APIは追加しません。

## 今回追加しないもの

- OpenAI API
- Gemini API
- Claude API
- 自前LLM
- ユーザー認証
- 課金機能
- SNS機能
- 在庫管理
- 買い物リスト
- 高度な栄養管理
- 外部レシピサイト連携

## ユーザーが手動で行う必要がある作業

本人のGoogleアカウント権限が必要なため、以下は手動です。

- Google Sheetsで `Recipe DB` を作成する
- Apps Scriptプロジェクトを作成する
- `gas/Code.gs` を貼り付ける
- `SPREADSHEET_ID` を設定する
- `DRIVE_FOLDER_ID` は写真アップロードを再利用する場合のみ設定する
- GAS Web Appをデプロイし、初回権限許可を行う
- GAS Web App URLを `config.js` に設定する
- GitHub Pagesを有効化する
- iPhone Safariで開いてホーム画面に追加する
