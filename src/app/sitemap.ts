import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteConfig.url}/`,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/mapa`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/metodologia`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
