---
title: HTTP Like a Bug Hunter — Hand-Written Requests, Hidden Headers and a Bug
  I Built Myself
category: Web Security
difficulty: Easy
date: 2026-11-28T13:30:00.000+05:30
---
HTTP. I know, "everyone knows HTTP". But most people only know the *definition*. Bug hunters need to know how to **read, rewrite and measure** requests. By the end of this post you will:

- Send a full HTTP request without a browser or curl, only raw text.
- Use curl as a **measuring tool**, not just a downloader.
- See how one extra header can change what a server does.
- Build your own vulnerable app (20 lines of Python) and break it.

> **Scope rule for this whole series:** I only test (1) my own local lab, (2) sites built for testing like `httpbin.org`, (3) intentionally vulnerable apps and (4) bug bounty targets **inside the program's written scope**. Never run these on a random website.

## Lab setup

You need `curl`, `openssl`, `nc` (netcat) and Python 3. On Kali/Ubuntu all of them are usually there.

```bash
curl --version | head -1
openssl version
nc -h 2>&1 | head -1
python3 --version
```

For later days, I also keep OWASP Juice Shop running locally (needs Docker):

```bash
docker run --rm -p 3000:3000 bkimminich/juice-shop
```

## Part 1: HTTP is just text. Prove it.

Browsers hide this from us. So let's talk to a server with nothing but text. Open a TLS connection and type the request ourselves:

```bash
printf 'GET /get HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n' \
  | openssl s_client -quiet -connect httpbin.org:443 -servername httpbin.org 2>/dev/null
```

What just happened:

- `\r\n` is the line ending HTTP uses (CRLF). Not `\n`. This small detail matters later in advanced topics like request smuggling.
- The **blank line** (`\r\n\r\n`) tells the server "headers are finished".
- `Host:` is mandatory in HTTP/1.1. It is a normal header the **client** controls. Remember this, Part 5 is built on it.

Same thing against a plain HTTP server on your own machine. Start a quick server in one terminal:

```bash
python3 -m http.server 8000
```

And in another terminal:

```bash
printf 'GET / HTTP/1.1\r\nHost: localhost:8000\r\nConnection: close\r\n\r\n' | nc -q1 127.0.0.1 8000
```

You get a response with status line, headers and an HTML directory listing. No magic. A request is a string; a response is a string.

## Part 2: Use curl as a measuring tool

Most people use `curl URL` and read the page. I use `-w` (write-out) and throw away the body. It prints *facts* about the response:

```bash
curl -s -o /dev/null \
  -w 'code=%{http_code} size=%{size_download} time=%{time_total}s http=%{http_version} ip=%{remote_ip} redirects=%{num_redirects}\n' \
  https://httpbin.org/get
```

Why this is powerful: **a status code alone can lie, but status + size + time together tell a story.** Examples of what to look for:

- Two different usernames give the same `200`, but one response is 1 byte bigger → the app is leaking which user exists.
- A valid ID returns in 40 ms, an invalid one in 400 ms → different code path behind the scenes.
- A `302` to `/login` vs a `403` → the server treats "not logged in" and "not allowed" differently.

Try the built-in delay endpoint to see time measurement in action:

```bash
curl -s -o /dev/null -w 'time=%{time_total}s\n' https://httpbin.org/delay/2
```

Follow redirects and count them:

```bash
curl -sL -o /dev/null -w 'final=%{url_effective} redirects=%{num_redirects}\n' https://httpbin.org/redirect/3
```

You should see `redirects=3`. Redirect chains matter: every hop is a place where a parameter can be trusted or validated badly (open redirects live here).

## Part 3: Response diffing

The most underrated skill. Don't "look" at responses, **diff** them. Make a baseline request, change one thing, and compare.

```bash
diff <(curl -s 'https://httpbin.org/anything?role=user') \
     <(curl -s 'https://httpbin.org/anything?role=admin')
```

(`<( ... )` is bash process substitution. If you use `sh` it will fail, use `bash`.)

`httpbin.org/anything` echoes back everything it received: args, headers, body. It is perfect to learn what you are *actually* sending. Always check this first when a tool (Burp, ffuf, a script) seems to behave strangely.

## Part 4: Same data, different Content-Type

A server decides how to parse your body from the `Content-Type` header. Send the same value three ways and look at which field of the response it lands in:

```bash
# form
curl -s https://httpbin.org/anything -d 'user=test'

# JSON
curl -s https://httpbin.org/anything -H 'Content-Type: application/json' -d '{"user":"test"}'

# plain text
curl -s https://httpbin.org/anything -H 'Content-Type: text/plain' -d 'user=test'
```

In the first, httpbin fills `"form"`. In the second, `"json"`. In the third, only raw `"data"`.

**Why a bug hunter cares:** many protections depend on the content type. An API that expects JSON might silently accept form data too, and then a protection that assumed "only JSON can arrive" (like some CSRF defences) stops working. Rule: *if an endpoint takes JSON, try sending the same data as a form. Note what changes.*

## Part 5: Parameter pollution

What if the same parameter appears twice?

```bash
curl -s 'https://httpbin.org/anything?id=1&id=2' | grep -A4 '"args"'
```

httpbin shows both values as a list. But a real framework may pick the **first**, the **last**, or join them. Now imagine a firewall that checks the first `id` and an app that uses the last one. That mismatch is the whole idea of HTTP Parameter Pollution. Different layers, different parsing = bugs.

Make it a habit: any time you see `?id=5`, also test `?id=5&id=6`, `?id[]=5` and `?id=5,6`, and compare the responses with `diff`.

## Part 6: Methods nobody tests

Everyone tests `GET` and `POST`. Check what else the server supports:

```bash
curl -si -X OPTIONS https://httpbin.org/get | head -12
curl -sI https://httpbin.org/get
```

`OPTIONS` often tells you the allowed methods in the `Allow` header. `HEAD` returns headers only.

On my local lab server (code below) the same requests give a different result:

```text
$ curl -si -X OPTIONS http://127.0.0.1:8000/reset | head -1
HTTP/1.0 501 Unsupported method ('OPTIONS')
```

Different method → different code path. In real apps, an access check written for `POST /admin/delete` may not exist for `PUT` or `DELETE` on the same path. Some frameworks also honour override headers:

```bash
curl -s https://httpbin.org/anything -X POST -H 'X-HTTP-Method-Override: DELETE' | grep -i '"method"'
```

httpbin only echoes it, but frameworks like some Java/PHP/Rails setups really treat that header as the method. Whether your target does is something you **test, not assume**.

## Part 7: Build the bug yourself (Host header trust)

Reading about a bug is good. Building it is better. Here is a deliberately naive "forgot password" page. Save as `vuln_reset.py` (local lab only):

```python
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        host = self.headers.get("Host", "localhost")
        fwd = self.headers.get("X-Forwarded-Host")
        if self.path.startswith("/reset"):
            base = fwd or host   # <-- the bug: trusting client-controlled headers
            body = f"Password reset link: http://{base}/new-password?token=abc123\n"
        else:
            body = "home\n"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body.encode())
    def log_message(self, *a): pass

HTTPServer(("127.0.0.1", 8000), H).serve_forever()
```

Run it: `python3 vuln_reset.py`. Normal request first:

```bash
curl -s http://127.0.0.1:8000/reset
```

```text
Password reset link: http://127.0.0.1:8000/new-password?token=abc123
```

Now change only the `Host` header:

```bash
curl -s http://127.0.0.1:8000/reset -H 'Host: attacker.test'
```

```text
Password reset link: http://attacker.test/new-password?token=abc123
```

And the common "behind a proxy" variant:

```bash
curl -s http://127.0.0.1:8000/reset -H 'X-Forwarded-Host: attacker.test'
```

```text
Password reset link: http://attacker.test/new-password?token=abc123
```

The server built a link using a value **the client controls**. In a real app, that link is emailed to the victim. If the victim clicks a link pointing to the attacker's domain, the attacker receives the reset token. This is called *password reset poisoning*, and it is a real class of bug.

Let's use the diff trick from Part 3 to make the change obvious:

```bash
diff <(curl -s http://127.0.0.1:8000/reset) \
     <(curl -s http://127.0.0.1:8000/reset -H 'Host: attacker.test')
```

```text
1c1
< Password reset link: http://127.0.0.1:8000/new-password?token=abc123
---
> Password reset link: http://attacker.test/new-password?token=abc123
```

One more useful curl flag, `--resolve`, lets you call a hostname without touching DNS or `/etc/hosts`:

```bash
curl -s --resolve app.test:8000:127.0.0.1 http://app.test:8000/reset
```

```text
Password reset link: http://app.test:8000/new-password?token=abc123
```

This is how you test virtual hosts: same IP, different `Host`, different site.

**The fix (what developers should do):** never build absolute URLs from the `Host` or `X-Forwarded-Host` header. Use a fixed, configured base URL (like `https://hacklogs.pages.dev`) or validate the host against an allow-list.

## Part 8: Read the headers the server gives you

Quick audit of response headers from any request you are allowed to make:

```bash
curl -s -D - -o /dev/null https://httpbin.org/get \
  | grep -iE '^(server|set-cookie|strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|x-powered-by)'
```

What to look for:

- `Server` or `X-Powered-By` showing exact versions → easier to look up known CVEs.
- Missing `Strict-Transport-Security` → HTTPS not enforced.
- Missing `X-Frame-Options` / CSP `frame-ancestors` → page may be framable (clickjacking).

Cookies deserve their own look. httpbin can set one for us:

```bash
curl -si 'https://httpbin.org/cookies/set?session=abc123' | grep -i '^set-cookie'
```

The cookie comes without `HttpOnly`, `Secure` and `SameSite`. For a real login cookie, those flags decide whether JavaScript can steal it, whether it travels over plain HTTP, and whether other sites can trigger requests with it.

## My checklist for every request

| Question | How I check |
|---|---|
| What exactly am I sending? | `https://httpbin.org/anything` or Burp Repeater |
| Which values can I control? | params, headers, cookies, JSON fields, path |
| Does the server trust any of them? | change one thing, then `diff` the responses |
| Do status, size and time change? | `curl -w` |
| Do other methods or content types work? | `OPTIONS`, `PUT`, JSON ↔ form |
| What do headers and cookies reveal? | header audit one-liner |

## Common mistakes I want to avoid

- Reading only the response body and ignoring headers.
- Changing five things at once. Change **one**, then compare.
- Trusting the browser's view. The browser hides, re-orders and adds headers.
- Testing real sites without permission. Labs first, always.

## Practice for today

1. Run every command in this post and change the values. Break things on purpose.
2. Rebuild `vuln_reset.py`, then fix it by hard-coding the base URL, and confirm the attack no longer works.
3. Do the free **PortSwigger Web Security Academy** topic "HTTP Host header attacks" (start with *Basic password reset poisoning*).

## Quick cheat sheet

```bash
# measure a response
curl -s -o /dev/null -w 'code=%{http_code} size=%{size_download} time=%{time_total}s\n' URL

# only headers of a normal GET
curl -s -D - -o /dev/null URL

# change Host without DNS
curl --resolve name:port:IP http://name:port/

# compare two requests
diff <(curl -s URL_A) <(curl -s URL_B)

# follow and count redirects
curl -sL -o /dev/null -w '%{num_redirects} %{url_effective}\n' URL
```

## Takeaway

HTTP is just text that the **client controls**: path, parameters, headers, cookies, body, even the `Host`. A bug appears when the server trusts any of it too much. Today's habit: *change one thing, measure, diff.*

**Tomorrow:** Burp Suite setup. Proxy, certificate, Repeater, and how to use everything from today inside it.
