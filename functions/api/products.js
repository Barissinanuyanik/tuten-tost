import { jsonResponse } from './_utils.js';

export async function onRequestGet(context) {
    try {
        const { env } = context;
        const { results } = await env.DB.prepare(
            "SELECT * FROM products ORDER BY CASE WHEN stock > 0 THEN 0 ELSE 1 END ASC, id ASC"
        ).all();
        return jsonResponse(results);
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}