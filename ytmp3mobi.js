/*
  `📸 Project ke *#3*`
 - 💾 F�lys(Files): ./ytmp3mobi.js (Scrapper)
 - ☎️ Tiktok: @drazzknyuk
 - Script Created By:  t.me/dapiyz
 
 📝 Note: Error Fix sendiri, Source ini bisa lu kembangin lagi kalo lu mau 😂
 */
import axios from "axios"
import { fileURLToPath } from "url"
import { realpathSync } from "fs"

const PAGE_URL = "https://id.ytmp3.mobi/mp3/"
const BACKEND = ".ymcdn.org"
const API_INIT = `https://a${BACKEND}/api/v1/init`

const client = axios.create({
  timeout: 20000,
  validateStatus: () => true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://id.ytmp3.mobi/mp3/",
    "Origin": "https://id.ytmp3.mobi",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty"
  }
})

const sleep = ms => new Promise(r => setTimeout(r, ms))
const noop = () => {}

function formatError(error) {
  if (error == null) return "Unknown error"
  if (typeof error === "string") return error
  if (typeof error === "object") {
    try { return JSON.stringify(error) } catch { return String(error) }
  }
  return String(error)
}

export function getVideoId(input) {
  let url
  try {
    url = new URL(input)
  } catch {
    throw new Error("URL tidak valid")
  }

  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split("/").filter(Boolean)

  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    if (parts[0]?.length === 11) return parts[0]
  }

  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v")
      if (id?.length === 11) return id
    }
    if (["shorts", "embed", "live"].includes(parts[0]) && parts[1]?.length === 11) {
      return parts[1]
    }
  }

  throw new Error("Video ID YouTube tidak ditemukan")
}

async function request(url) {
  const res = await client.get(url)
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}: ${formatError(res.data)}`)
  }
  return res.data
}

async function openPage() {
  const page = await client.get(PAGE_URL)
  if (page.status < 200 || page.status >= 300) {
    throw new Error(`Page HTTP ${page.status}`)
  }
}

/**
 * Convert satu format (dipakai internal oleh convert & convertAll).
 */
async function runConversion(videoId, format, { maxAttempts, interval, log }) {
  const tag = `[${format}]`

  log(tag, "Initialize...")
  const init = await request(`${API_INIT}?p=y&23=1llum1n471&_=${Math.random()}`)
  if (init.error) throw new Error(`Init error: ${formatError(init.error)}`)
  if (!init.convertURL) throw new Error("convertURL tidak diberikan oleh API")

  const conversionURL =
    `${init.convertURL}` +
    `&v=${encodeURIComponent(videoId)}` +
    `&f=${encodeURIComponent(format)}` +
    `&_=${Math.random()}`

  log(tag, "Request conversion...")
  const conversion = await request(conversionURL)
  if (conversion.error) throw new Error(`Conversion error: ${formatError(conversion.error)}`)
  if (!conversion.progressURL) throw new Error("progressURL tidak ditemukan")
  if (!conversion.downloadURL) throw new Error("downloadURL tidak ditemukan")

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(interval)

    const progress = await request(conversion.progressURL)
    if (progress.error) throw new Error(`Progress error: ${formatError(progress.error)}`)

    log(
      tag,
      `[${attempt}/${maxAttempts}] Progress: ${progress.progress ?? "?"}`,
      progress.title ? `| ${progress.title}` : ""
    )

    if (Number(progress.progress) >= 3) {
      return {
        format,
        title: progress.title || "Unknown",
        downloadURL: conversion.downloadURL
      }
    }
  }

  throw new Error(`Timeout: ${format} tidak selesai dalam ${(maxAttempts * interval) / 1000} detik`)
}

/**
 * Convert satu format saja.
 *
 * @param {string} input   URL YouTube
 * @param {"mp3"|"mp4"} format
 * @param {{ maxAttempts?: number, interval?: number, verbose?: boolean }} [opts]
 * @returns {Promise<{format: string, title: string, downloadURL: string}>}
 */
export async function convert(input, format = "mp3", opts = {}) {
  if (!["mp3", "mp4"].includes(format)) {
    throw new Error("Format hanya mp3 atau mp4")
  }
  const { maxAttempts = 120, interval = 1000, verbose = false } = opts
  const log = verbose ? console.log : noop

  const videoId = getVideoId(input)
  await openPage()
  return runConversion(videoId, format, { maxAttempts, interval, log })
}

/**
 * Convert MP3 & MP4 sekaligus (paralel).
 * Kalau salah satu gagal, yang lain tetap dikembalikan.
 *
 * @returns {Promise<{
 *   videoId: string,
 *   mp3: {title: string, downloadURL: string} | null,
 *   mp4: {title: string, downloadURL: string} | null,
 *   errors: { mp3?: string, mp4?: string }
 * }>}
 */
export async function convertAll(input, opts = {}) {
  const { maxAttempts = 120, interval = 1000, verbose = false } = opts
  const log = verbose ? console.log : noop

  const videoId = getVideoId(input)
  await openPage()

  const formats = ["mp3", "mp4"]
  const settled = await Promise.allSettled(
    formats.map(f => runConversion(videoId, f, { maxAttempts, interval, log }))
  )

  const out = { videoId, mp3: null, mp4: null, errors: {} }
  settled.forEach((res, i) => {
    const f = formats[i]
    if (res.status === "fulfilled") {
      const { title, downloadURL } = res.value
      out[f] = { title, downloadURL }
    } else {
      out.errors[f] = res.reason?.message || formatError(res.reason)
    }
  })

  return out
}

export default convertAll

/* ---------------- CLI ----------------
 * Hanya jalan kalau file ini dieksekusi langsung:
 *   node ytmp3mobi.js "https://youtube.com/watch?v=VIDEO_ID"
 * Kalau di-import dari script lain, bagian ini dilewati.
 */
const isMain = (() => {
  try {
    return process.argv[1] &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isMain) {
  const input = process.argv[2]
  if (!input) {
    console.log('Usage: node ytmp3mobi.js "https://youtube.com/watch?v=VIDEO_ID"')
    process.exit(1)
  }

  try {
    const r = await convertAll(input, { verbose: true })
    console.log("\n=== RESULT ===")
    for (const f of ["mp3", "mp4"]) {
      if (r[f]) {
        console.log(`\n[${f.toUpperCase()}] ${r[f].title}`)
        console.log(r[f].downloadURL)
      } else {
        console.log(`\n[${f.toUpperCase()}] GAGAL: ${r.errors[f]}`)
      }
    }
  } catch (e) {
    console.error("\nError:", e.message)
    process.exit(1)
  }
}
