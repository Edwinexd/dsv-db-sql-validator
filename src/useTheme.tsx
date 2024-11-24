// useTheme.ts
import { useState, useEffect, useCallback } from "react";

const useTheme = () => {
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const storedTheme = localStorage.theme as "light" | "dark" | "system";
    if (storedTheme) {
      setThemeState(storedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setThemeState("dark");
    } else {
      setThemeState("light");
    }

    const applyTheme = () => {
      if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();
    window.addEventListener("storage", applyTheme);

    return () => {
      window.removeEventListener("storage", applyTheme);
    };
  }, []);

  const setTheme = (theme: "light" | "dark" | "system") => {
    setThemeState(theme);
    if (theme === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.theme = theme;
    }

    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const getTheme = () => {
    return theme;
  };

  // useCallback, isDarkMode
  const isDarkMode = useCallback(() => {
    return theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, [theme]);

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  return { theme, getTheme, setTheme, toggleTheme, isDarkMode };
};

export default useTheme;
