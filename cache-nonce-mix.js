addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/* ====================================

headers handling . . .
based on https://stackoverflow.com/questions/11560101/caching-json-with-cloudflare/56069077#56069077
as of 2021-05-01

nonce for CSP . . .
based on https://github.com/moveyourdigital/cloudflare-worker-csp-nonce
as of 2021-08-25

Also useful . . .
https://gist.github.com/RiFi2k/c3c65d59ca7f225e1d7d56929e0275ad
as of 2021-10-17

==================================== */

function dec2hex(dec) {
  return ("0" + dec.toString(16)).substr(-2)
}

function generateNonce() {
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  const values = Array.from(arr, dec2hex)
  return [
    btoa(values.slice(0, 5).join("")).substr(0, 14),
    btoa(values.slice(5).join("")),
  ].join("/")
}

/**
 * Respond to the request
 * @param {Request} request
 */

async function handleRequest(request) {
  const nonce = generateNonce()
  let response = await fetch(request)

  let imageResponse = await fetch(request)
  let type = imageResponse.headers.get("Content-Type") || ""
  if (!type.startsWith("text/")) {
    // Not text. Don't modify.
    let newHeaders = new Headers(imageResponse.headers)
    newHeaders.set("Cache-Control", "public, max-age=2678400, immutable")
    newHeaders.set("CDN-Cache-Control", "public, max-age=2678400, immutable")
    newHeaders.set("x-BW-test", "Non-text item - headers edited!")
    // newHeaders.set("Permissions-Policy", "interest-cohort=()")
    newHeaders.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
    newHeaders.set("X-Frame-Options", "SAMEORIGIN")
    newHeaders.set("X-Content-Type-Options", "nosniff")
    newHeaders.set("Referrer-Policy", "no-referrer, strict-origin-when-cross-origin")
    newHeaders.set("cf-nonce-generator", "HIT")
    return new Response(imageResponse.body, {
      status: imageResponse.status,
      statusText: imageResponse.statusText,
      headers: newHeaders
    })
  }

  const html = (await response.text())
    .replace(/DhcnhD3khTMePgXw/gi, nonce)
    .replace(
      'src="https://ajax.cloudflare.com',
      `nonce="${nonce}" src="https://ajax.cloudflare.com`
    )
    .replace(
      'src="https://static.cloudflareinsights.com',
      `nonce="${nonce}" src="https://static.cloudflareinsights.com`
    )
    .replace(
      'cloudflare-static/email-decode.min.js"',
      `cloudflare-static/email-decode.min.js" nonce="${nonce}"`
    )

  let ttl = undefined
  let cache = caches.default
  let url = new URL(request.url)
  let shouldCache = false
  let jsStuff = false
  let svgStuff = false

  const filesRegex = /(.*\.(ac3|avi|bmp|br|bz2|css|cue|dat|doc|docx|dts|eot|exe|flv|gif|gz|ico|img|iso|jpeg|jpg|js|json|map|mkv|mp3|mp4|mpeg|mpg|ogg|pdf|png|ppt|pptx|qt|rar|rm|svg|swf|tar|tgz|ttf|txt|wav|webp|webm|webmanifest|woff|woff2|xls|xlsx|xml|zip))$/
  const jsRegex = /(.*\.(js))$/
  const svgRegex = /(.*\.(svg))$/

  if (url.pathname.match(filesRegex)) {
    shouldCache = true
    ttl = 31536000
  }
  if (url.pathname.match(jsRegex)) {
    jsStuff = true
  }
  if (url.pathname.match(svgRegex)) {
    svgStuff = true
  }

  let newHeaders = new Headers(response.headers)
  newHeaders.set("Cache-Control", "public, max-age=0")
  // newHeaders.set("Permissions-Policy", "interest-cohort=()")
  newHeaders.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  newHeaders.set("X-Frame-Options", "SAMEORIGIN")
  newHeaders.set("X-Content-Type-Options", "nosniff")
  newHeaders.set("Referrer-Policy", "no-referrer, strict-origin-when-cross-origin")
  if (ttl) {
    newHeaders.set("Cache-Control", "public, max-age=" + ttl + ", immutable")
    newHeaders.set("CDN-Cache-Control", "public, max-age=" + ttl + ", immutable")
  } else {
    newHeaders.set("Content-Security-Policy-Report-Only", `report-uri https://brycewray.report-uri.com/r/d/csp/reportOnly; default-src 'self' https://*.brycewray.com; connect-src 'self' https://*.brycewray.com https://*.cloudinary.com https://*.cloudflareinsights.com https://cloudflareinsights.com https://*.ytimg.com https://*.ggpht.com https://*.youtube-nocookie.com; base-uri 'self' https://*.brycewray.com; frame-src 'self' https://*.brycewray.com https://*.youtube-nocookie.com; frame-ancestors 'self' https://*.brycewray.com https://*.youtube-nocookie.com; form-action 'self'; style-src 'self' https://*.brycewray.com https://*.youtube-nocookie.com data:; style-src-attr 'self' https://*.brycewray.com; img-src 'self' https://*.brycewray.com https://*.cloudinary.com https://*.ytimg.com https://*.ggpht.com https://*.youtube-nocookie.com https://*.gstatic.com data:; font-src 'self' https://*.brycewray.com https://*.gstatic.com; script-src 'nonce-${nonce}' 'strict-dynamic' https: 'self'; script-src-elem 'self' https://*.brycewray.com 'nonce-${nonce}'`)
    newHeaders.set("Report-To", "{'group':'default','max_age':31536000,'endpoints':[{'url':'https://brycewray.report-uri.com/a/d/g'}],'include_subdomains':true}")
    newHeaders.set("X-XSS-Protection", "1")
  }
  newHeaders.set("cf-nonce-generator", "HIT")
  if (jsStuff) {
    newHeaders.set("Content-Type", "application/javascript; charset=utf-8")
  }
  if (svgStuff) {
    newHeaders.set("Content-Type", "image/svg+xml; charset=utf-8")
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}
