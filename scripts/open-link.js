#!/usr/bin/env node
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
const { Client } = require("@notionhq/client");
const args = require("minimist")(process.argv.slice(2));

const target = (args.target || "miro").toLowerCase(); // "miro" | "notion"
const filePath = args.path;

if (!filePath) {
    console.error("Missing --path");
    process.exit(1);
}
const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
    const DB = process.env.NOTION_DB_MODULES;
    if (!DB) {
        console.error("❌ NOTION_DB_MODULES is missing in .env.local");
        process.exit(1);
    }
    const rel = filePath.replace(/^\.?\//, "");
    console.log(`🔍 Searching for path: "${rel}"`);

    const resp = await notion.databases.query({
        database_id: DB,
        filter: { property: "Path", rich_text: { contains: rel } }
    });

    console.log(`📊 Found ${resp.results.length} results`);

    if (!resp.results.length) {
        console.error(`No Notion row found for Path contains "${rel}"`);
        process.exit(2);
    }

    const page = resp.results[0];
    const props = page.properties;
    const miro = props["Miro Node URL"]?.url || props["Miro Node Link"]?.url || "";
    const notionUrl = page.url;

    console.log(`🎯 Target: ${target}`);
    console.log(`🔗 Miro URL: ${miro || "(empty)"}`);
    console.log(`📝 Notion URL: ${notionUrl}`);

    if (target === "miro") {
        if (!miro) {
            console.error(`No Miro URL on this row. Fill "Miro Node URL" first.`);
            process.exit(3);
        }
        // Import open dynamically for ES modules compatibility
        const { default: open } = await import("open");
        await open(miro);
        console.log(`✅ Opened Miro: ${miro}`);
    } else {
        // Import open dynamically for ES modules compatibility
        const { default: open } = await import("open");
        await open(notionUrl);
        console.log(`✅ Opened Notion: ${notionUrl}`);
    }
})();
