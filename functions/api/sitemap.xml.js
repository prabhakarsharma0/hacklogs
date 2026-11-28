export async function onRequest(context) {
  const { request } = context;

  // GitHub repo details (same as index.html)
  const OWNER = "prabhakarsharma0";
  const REPO = "hacklogs";
  const BRANCH = "main";
  const WRITEUPS_PATH = "content/writeups";

  try {
    // Fetch list of markdown files from GitHub
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${WRITEUPS_PATH}?ref=${BRANCH}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "HackLogs-Sitemap"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const files = await response.json();
    
    // Filter only .md files
    const mdFiles = Array.isArray(files)
      ? files.filter(f => f.type === "file" && f.name.toLowerCase().endsWith(".md"))
      : [];

    // Build sitemap XML
    const urls = [
      {
        loc: "https://hacklogs.pages.dev/",
        changefreq: "weekly",
        priority: "1.0"
      }
    ];

    // Add each writeup
    mdFiles.forEach(file => {
      urls.push({
        loc: `https://hacklogs.pages.dev/post.html?file=${encodeURIComponent(file.name)}`,
        changefreq: "monthly",
        priority: "0.8",
        // lastmod optional - GitHub API se mil sakta hai agar chahiye
        lastmod: file.updated_at ? file.updated_at.split("T")[0] : null
      });
    });

    // Generate XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    urls.forEach(url => {
      xml += `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>`;
      
      if (url.lastmod) {
        xml += `
    <lastmod>${url.lastmod}</lastmod>`;
      }
      
      xml += `
  </url>
`;
    });

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600" // 1 hour cache
      }
    });

  } catch (error) {
    console.error("Sitemap generation failed:", error);

    // Fallback basic sitemap
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://hacklogs.pages.dev/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallback, {
      headers: {
        "Content-Type": "application/xml"
      }
    });
  }
}