export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // GitHub OAuth URL banate hain
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
  githubAuthUrl.searchParams.set('scope', 'repo,user');
  githubAuthUrl.searchParams.set('state', crypto.randomUUID()); 
  
  return Response.redirect(githubAuthUrl.toString(), 302);
}
