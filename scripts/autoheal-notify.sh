#!/bin/bash
# ============================================================
# AgriSense Autoheal Telegram Notifier
# ============================================================
# Script ini dijalankan oleh Cron setiap 15 menit.
# Tugas: Membaca log Autoheal, jika ada restart dalam
#        15 menit terakhir, kirim notifikasi ke Telegram.
#
# Cara pakai:
#   1. Buat file konfigurasi di server:
#      /opt/agrisense/.env
#      Isi:
#        TELEGRAM_BOT_TOKEN=token_anda
#        TELEGRAM_CHAT_ID=chatid_anda
#   2. Letakkan file ini di server: /opt/agrisense/autoheal-notify.sh
#   3. Beri izin: chmod +x /opt/agrisense/autoheal-notify.sh
#   4. Tambahkan ke crontab: crontab -e
#      */15 * * * * /opt/agrisense/autoheal-notify.sh >> /var/log/autoheal-notify.log 2>&1
#
# KEAMANAN: Token TIDAK disimpan di file ini.
#           Token disimpan di /opt/agrisense/.env (hanya ada di server).
#           File .env TIDAK boleh di-push ke GitHub!
# ============================================================

# ── BACA KONFIGURASI DARI FILE .ENV PROYEK ─────────────────
# Mendeteksi otomatis file .env yang ada di root proyek
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [ ! -f "${ENV_FILE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S WIB')] ❌ File konfigurasi ${ENV_FILE} tidak ditemukan!"
    echo "  Pastikan file .env ada di folder utama proyek dengan isi:"
    echo "    TELEGRAM_BOT_TOKEN=token_anda"
    echo "    TELEGRAM_CHAT_ID=chatid_anda"
    exit 1
fi

# Muat variabel dari file .env
source "${ENV_FILE}"

# Validasi bahwa token dan chat_id sudah diisi
if [ -z "${TELEGRAM_BOT_TOKEN}" ] || [ -z "${TELEGRAM_CHAT_ID}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S WIB')] ❌ TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID kosong di ${ENV_FILE}!"
    exit 1
fi
# ────────────────────────────────────────────────────────────

# ── KONFIGURASI OPSIONAL ────────────────────────────────────
CONTAINER_NAME="agrisense-autoheal"
CHECK_INTERVAL="15m"  # Harus sama dengan interval cron
# ────────────────────────────────────────────────────────────

# Timestamp untuk log lokal
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S WIB')

# Fungsi kirim pesan ke Telegram
send_telegram() {
    local MESSAGE="$1"
    curl -s -X POST \
        "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "parse_mode=HTML" \
        -d "text=${MESSAGE}" \
        > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "[${TIMESTAMP}] ✅ Notifikasi Telegram berhasil dikirim."
    else
        echo "[${TIMESTAMP}] ❌ GAGAL mengirim notifikasi Telegram!"
    fi
}

# ── LOGIKA UTAMA ────────────────────────────────────────────

# Cek apakah container autoheal berjalan
if ! docker ps --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    echo "[${TIMESTAMP}] ⚠️  Container ${CONTAINER_NAME} tidak ditemukan atau tidak berjalan."
    
    # Kirim peringatan bahwa autoheal sendiri mati
    MESSAGE="🔴 <b>PERINGATAN KRITIS</b>%0A%0A"
    MESSAGE+="Container <code>${CONTAINER_NAME}</code> tidak berjalan!%0A"
    MESSAGE+="Sistem auto-healing TIDAK AKTIF.%0A%0A"
    MESSAGE+="⏰ Waktu: ${TIMESTAMP}%0A"
    MESSAGE+="🖥️ Server: AgriSense Production"
    
    send_telegram "${MESSAGE}"
    exit 1
fi

# Ambil log autoheal dalam 15 menit terakhir
RESTART_LOGS=$(docker logs --since "${CHECK_INTERVAL}" "${CONTAINER_NAME}" 2>&1 | grep -iE "restart|unhealthy|restarting")

# Jika ada restart, kirim notifikasi
if [ -n "${RESTART_LOGS}" ]; then
    # Hitung jumlah restart
    RESTART_COUNT=$(echo "${RESTART_LOGS}" | wc -l)
    
    # Ambil nama kontainer yang di-restart (parsing dari log)
    AFFECTED=$(echo "${RESTART_LOGS}" | grep -oP '(?<=restarting container )[\w/-]+' | sort -u | tr '\n' ', ' | sed 's/,$//')
    
    if [ -z "${AFFECTED}" ]; then
        AFFECTED="(lihat detail di log server)"
    fi

    echo "[${TIMESTAMP}] 🚨 Terdeteksi ${RESTART_COUNT} event restart!"
    
    # Susun pesan Telegram
    MESSAGE="🚨 <b>AUTOHEAL REPORT</b> 🚨%0A%0A"
    MESSAGE+="Sistem mendeteksi kontainer yang macet dan telah di-restart secara otomatis.%0A%0A"
    MESSAGE+="📊 <b>Jumlah event:</b> ${RESTART_COUNT}%0A"
    MESSAGE+="📦 <b>Kontainer:</b> ${AFFECTED}%0A"
    MESSAGE+="⏰ <b>Waktu cek:</b> ${TIMESTAMP}%0A"
    MESSAGE+="🔄 <b>Periode:</b> ${CHECK_INTERVAL} terakhir%0A%0A"
    MESSAGE+="<i>Cek detail: docker logs ${CONTAINER_NAME}</i>"
    
    send_telegram "${MESSAGE}"
else
    echo "[${TIMESTAMP}] ✅ Tidak ada restart dalam ${CHECK_INTERVAL} terakhir. Semua aman."
fi

