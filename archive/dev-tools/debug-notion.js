#!/usr/bin/env node
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
    const DB = process.env.NOTION_DB_MODULES;
    console.log(`📋 DB ID: ${DB}`);

    const resp = await notion.databases.query({
        database_id: DB,
        filter: { property: "Path", rich_text: { contains: "RouteCircle" } }
    });

    console.log(`📊 Found ${resp.results.length} results`);

    if (resp.results.length > 0) {
        const page = resp.results[0];
        const props = page.properties;
        console.log(`🎯 Page ID: ${page.id}`);
        console.log(`📝 Page URL: ${page.url}`);

        const miroUrl = props["Miro Node URL"];
        console.log(`🔗 Miro property:`, miroUrl);

        if (miroUrl) {
            const url = miroUrl.url;
            console.log(`✅ Miro URL: ${url}`);
        }
    }
})().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
