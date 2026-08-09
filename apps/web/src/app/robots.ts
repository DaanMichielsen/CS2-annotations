import type { MetadataRoute } from 'next'

// Production had no robots.txt at all (it 404'd), so crawlers were free to walk
// every filter/sort/page permutation of /guides and /library. Each of those is a
// dynamically rendered page, and each isolated request wakes the Neon compute for
// a billed minimum of 5 minutes. See docs/dev/database-cost.md.
//
// Content pages stay crawlable for SEO; only the combinatorial and private
// surfaces are closed off.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Every query-string URL on this site is a filter/sort/pagination
          // permutation — no SEO value, unbounded crawl space.
          '/*?',
          '/api/',
          '/auth/',
          // Signed-in-only surfaces; these redirect anonymous visitors anyway.
          '/admin',
          '/for-you',
          '/my-guides',
          '/saved',
          '/profile/edit',
          '/guides/*/edit',
          '/guides/*/play',
        ],
      },
      // Bulk AI/SEO scrapers that provide no referral traffic but crawl hardest.
      {
        userAgent: [
          'GPTBot',
          'CCBot',
          'ClaudeBot',
          'Google-Extended',
          'anthropic-ai',
          'Bytespider',
          'PerplexityBot',
          'AhrefsBot',
          'SemrushBot',
          'DotBot',
          'MJ12bot',
        ],
        disallow: '/',
      },
    ],
  }
}
