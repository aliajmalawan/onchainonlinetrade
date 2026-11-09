// Runs before `npm run dev` (the "predev" script). The Vite dev server
// proxies /api to the PHP backend under XAMPP, so if Apache or MySQL isn't
// running (e.g. after a reboot) every API call — login included — fails with
// "Request failed". This starts whichever of the two is down, then waits for
// it to accept connections. Windows/XAMPP only; elsewhere it does nothing.
import net from 'node:net'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const XAMPP = process.env.XAMPP_DIR || 'C:\\xampp'

const SERVICES = [
  {
    name: 'MySQL',
    port: 3306,
    exe: path.join(XAMPP, 'mysql', 'bin', 'mysqld.exe'),
    args: [`--defaults-file=${path.join(XAMPP, 'mysql', 'bin', 'my.ini')}`, '--standalone'],
  },
  {
    name: 'Apache',
    port: 80,
    exe: path.join(XAMPP, 'apache', 'bin', 'httpd.exe'),
    args: [],
  },
]

function isUp(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(false))
  })
}

async function waitUntilUp(port, ms) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await isUp(port)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

if (process.platform === 'win32') {
  for (const s of SERVICES) {
    if (await isUp(s.port)) {
      console.log(`[backend] ${s.name} is running (port ${s.port}).`)
      continue
    }
    if (!existsSync(s.exe)) {
      console.warn(`[backend] ${s.name} is not running and ${s.exe} was not found — start it from the XAMPP Control Panel.`)
      continue
    }
    console.log(`[backend] ${s.name} is not running — starting it…`)
    // Detached so it keeps running after this script (and the dev server) exit.
    spawn(s.exe, s.args, { cwd: path.dirname(s.exe), detached: true, stdio: 'ignore', windowsHide: true }).unref()
    if (await waitUntilUp(s.port, 20000)) {
      console.log(`[backend] ${s.name} started (port ${s.port}).`)
    } else {
      console.warn(`[backend] ${s.name} did not come up on port ${s.port} — check the XAMPP Control Panel or its error log.`)
    }
  }
}
