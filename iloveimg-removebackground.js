/*
  `📸 Project ke *#2*`
 - 💾 F�lys(Files): ./iloveimg-removebackground.js (Scrapper)
 - ☎️ Tiktok: @drazzknyuk
 - Script Created By:  t.me/dapiyz
 
 📝 Note: Error Fix sendiri, Source ini bisa lu kembangin lagi kalo lu mau 😂
 */

import axios from "axios"
import FormData from "form-data"
import fs from "fs"

const PAGE_URL = "https://www.iloveimg.com/remove-background"

const userAgent =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36"
  
/**
 * Input dinamis: URL (http/https) atau path file lokal
 */
async function getInput(input) {
  if (/^https?:\/\//i.test(input)) {
    const response = await axios.get(input, {
      responseType: "arraybuffer"
    })

    return {
      buffer: Buffer.from(response.data),
      filename: "image.jpg"
    }
  }

  if (!fs.existsSync(input)) {
    throw new Error(`File tidak ditemukan: ${input}`)
  }

  return {
    stream: fs.createReadStream(input),
    filename: input.split("/").pop()
  }
}

/**
 * Ambil token + taskId + servers dari halaman iLoveIMG
 */
async function getConfig() {
  const { data: html } = await axios.get(PAGE_URL, {
    headers: { "User-Agent": userAgent }
  })

  const configMatch = html.match(/var ilovepdfConfig = (\{[\s\S]*?\});/)
  if (!configMatch) throw new Error("ilovepdfConfig tidak ditemukan")

  const config = JSON.parse(configMatch[1])

  const taskMatch = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)
  if (!taskMatch) throw new Error("taskId tidak ditemukan")

  config.taskId = taskMatch[1]

  if (!config.token) throw new Error("token tidak ditemukan")
  if (!config.servers?.length) throw new Error("servers tidak ditemukan")

  // Ambil server pertama. Contoh: api4g -> https://api4g.iloveimg.com
  const server = config.servers[0]

  config.workerServer = server.includes(".com")
    ? `https://${server}`
    : `https://${server}.${config.site}.com`

  return config
}

/**
 * Upload file ke API iLoveIMG
 * @returns {Promise<string>} server_filename
 */
async function uploadFile(api, config, file) {
  const form = new FormData()

  form.append("task", config.taskId)
  form.append("preview", "1")
  form.append("pdfinfo", "0")
  form.append("pdfforms", "0")

  const fileData = file.buffer || file.stream
  form.append("file", fileData, { filename: file.filename })

  const { data } = await api.post("/upload", form, {
    headers: {
      ...form.getHeaders(),
      Accept: "application/json"
    }
  })

  if (!data.server_filename) {
    throw new Error("server_filename tidak ditemukan")
  }

  return data.server_filename
}

/**
 * Remove background
 * @param {string} input - URL (http/https) atau path file lokal
 * @param {string} [outputPath] - (opsional) simpan hasil ke file
 * @returns {Promise<Buffer>} buffer PNG hasil
 */
async function removeBackground(input, outputPath) {
  if (!input) throw new Error("input wajib diisi (URL atau path file)")

  const file = await getInput(input)
  const config = await getConfig()

  const api = axios.create({
    baseURL: `${config.workerServer}/v1`,
    headers: { Authorization: `Bearer ${config.token}` },
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  })

  const serverFilename = await uploadFile(api, config, file)

  const form = new FormData()
  form.append("task", config.taskId)
  form.append("server_filename", serverFilename)

  const result = await api.post("/removebackground", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer"
  })

  const buffer = Buffer.from(result.data)

  if (outputPath) fs.writeFileSync(outputPath, buffer)

  return buffer
}

export default removeBackground