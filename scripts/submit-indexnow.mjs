const KEY = "10f8619456c2ea84499dd5e46ca68a4c";
const HOST = "qwickword.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  throw new Error("Pass one or more changed https://qwickword.com URLs.");
}

for (const value of urls) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== HOST) {
    throw new Error(`Refusing URL outside https://${HOST}: ${value}`);
  }
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});

console.log(
  JSON.stringify({
    endpoint: ENDPOINT,
    status: response.status,
    accepted: response.status === 200 || response.status === 202,
    urls,
  })
);

if (response.status !== 200 && response.status !== 202) {
  process.exitCode = 1;
}
