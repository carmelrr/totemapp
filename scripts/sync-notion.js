#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_DB_MODULES;

function getText(prop) {
    if (!prop) return "";
    if (prop.type === "title" || prop.type === "rich_text") {
        const arr = prop[prop.type] || [];
        return arr.map(t => t.plain_text).join("");
    }
    if (prop.type === "url") return prop.url || "";
    if (prop.type === "select") return prop.select?.name || "";
    if (prop.type === "multi_select") return (prop.multi_select || []).map(s => s.name).join(", ");
    return "";
}

(async () => {
    if (!DB) {
        console.error("❌ NOTION_DB_MODULES is missing in .env.local");
        process.exit(1);
    }
    const rows = [];
    let cursor;
    do {
        const resp = await notion.databases.query({ database_id: DB, start_cursor: cursor });
        rows.push(...resp.results);
        cursor = resp.has_more ? resp.next_cursor : undefined;
    } while (cursor);

    const lines = [];
    lines.push(`# Modules (sync from Notion)\n`);
    lines.push(`| Name | Path | Type | Role | Miro Node URL | Status |`);
    lines.push(`|---|---|---|---|---|---|`);

    for (const r of rows) {
        const p = r.properties;
        const name = getText(p["Name"]);
        const pathProp = getText(p["Path"]);
        const type = getText(p["Type"]);
        const role = getText(p["Role"]);
        const miro = p["Miro Node URL"] ? getText(p["Miro Node URL"]) : (p["Miro Node Link"] ? getText(p["Miro Node Link"]) : "");
        const status = getText(p["Status"]);
        lines.push(`| ${name} | ${pathProp} | ${type} | ${role} | ${miro} | ${status} |`);
    }

    const outDir = path.resolve(process.cwd(), "docs");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, "modules.md"), lines.join("\n"), "utf8");
    console.log("✅ Wrote docs/modules.md");
})();
