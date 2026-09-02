require("dotenv").config({ path: ".env.local" });

console.log("Key loaded:", !!process.env.GEMINI_API_KEY);

fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
        contents: [{ parts: [{ text: "Say exactly: GEMINI WORKING" }] }],
    }),
})
    .then(async (r) => {
        console.log("HTTP:", r.status);
        console.log(await r.text());
    })
    .catch((err) => {
        console.error("ERROR:", err);
    });