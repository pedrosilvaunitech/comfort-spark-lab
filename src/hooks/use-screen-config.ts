import { useState, useEffect } from "react";
import { type ScreenConfig, defaultScreenConfig, loadScreenConfig } from "@/lib/screen-config";

export function useScreenConfig() {
  const [config, setConfig] = useState<ScreenConfig>(defaultScreenConfig);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadScreenConfig().then((c) => {
      setConfig(c);
      setLoaded(true);
      // Apply favicon
      if (c.faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) link.href = c.faviconUrl;
      }
      // Apply document title
      if (c.systemName) document.title = c.systemName;
    });
  }, []);

  return { config, loaded };
}
