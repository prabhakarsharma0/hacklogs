export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  // GitHub se access token request karo
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: `${url.origin}/auth/callback`
    })
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return new Response(`Error: ${tokenData.error_description}`, { status: 400 });
  }

  // Decap CMS ko token wapas bhejne ke liye HTML page banate hain
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <script>
        window.opener.postMessage(
          'authorization:github:success:{"token":"${tokenData.access_token}","provider":"github"}',
          window.location.origin
        );
        window.close();
      </script>
      <p>Authorization successful. You can close this window.</p>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
