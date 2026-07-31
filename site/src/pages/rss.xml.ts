import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE_NAME, SITE_URL } from "../config/site";

export const GET: APIRoute = async (context) => {
  const articles = (await getCollection("articles"))
    .filter((a) => !a.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: SITE_NAME,
    description: `Articles from ${SITE_NAME}`,
    site: context.site ?? SITE_URL,
    trailingSlash: true,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.date,
      link: `/articles/${article.data.slug}/`,
    })),
  });
};
