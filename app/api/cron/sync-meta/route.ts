import { NextRequest, NextResponse } from 'next/server'

// Llamado por Vercel Cron diariamente — pre-calienta los rangos más usados
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const today = new Date().toISOString().slice(0, 10)
  function daysAgo(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
  }
  function monthStart() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  const ranges = [
    { since: daysAgo(7),     until: today },
    { since: daysAgo(30),    until: today },
    { since: monthStart(),   until: today },
  ]

  const results = await Promise.allSettled(
    ranges.map(({ since, until }) =>
      fetch(`${base}/api/meta-ads?since=${since}&until=${until}&force=1`)
    )
  )

  const synced  = results.filter(r => r.status === 'fulfilled').length
  const failed  = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ ok: true, synced, failed, at: new Date().toISOString() })
}
