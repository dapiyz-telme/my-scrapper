/*
  `📸 Project ke *#1*`
 - 💾 F�lys(Files): ./lucioushentai.js (Scrapper)
 - ☎️ Tiktok: @drazzknyuk
 - Script Created By:  t.me/dapiyz
 
 📝 Note: Error Fix sendiri, Source ini bisa lu kembangin lagi kalo lu mau 😂
 */
import * as cheerio from "cheerio"
import {
 writeFile 
} from "node:fs/promises"

const target = "https://lucioushentai.com/unlock-shizuku-oikawas-secret-111-pic-sex-collection/"

const html = await fetch(target).then(r => r.text())
const $ = cheerio.load(html)

const candidates = $("img[src]")
  .map((_, el) => $(el).attr("src"))
  .get()
  .filter(src =>
    /\/data\/[^/]+(?:-\d+)?\.[a-z0-9]+$/i.test(src)
  )

const groups = {}

for (const src of candidates) {
  const match = src.match(
    /\/data\/(.+?)(?:-\d+)?\.[a-z0-9]+$/i
  )

  if (!match) continue

  const name = match[1]

  groups[name] ??= []
  groups[name].push(src)
}

const images =
  Object.values(groups)
    .sort((a, b) => b.length - a.length)[0] || []

const { hostname: domain, pathname } = new URL(target)
const name = pathname.split("/").filter(Boolean).pop() || "home"

await writeFile(
  `results-${domain}-${name}.json`,
  JSON.stringify(images, null, 2)
)

console.log(`Berhasil inject ${domain} | Saved: ${images.length} image URLs\n`)
console.log(JSON.stringify(images, null, 2))