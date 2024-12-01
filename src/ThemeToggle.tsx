import React from "react";

import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";

interface ThemeToggleProps {
  setTheme: (theme: "light" | "dark" | "system") => void;
  isDarkMode: () => boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ setTheme, isDarkMode }) => {
  return (
    <button
      onClick={() => {setTheme(isDarkMode() ? "light" : "dark");}}
      className="p-2 rounded-full text-blue-500 dark:text-yellow-500 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-yellow-500 flex items-center justify-center"
    >
      {isDarkMode() ? (
        <SunIcon className="w-5 h-5 m-auto" />
      ) : (
        <MoonIcon className="w-5 h-5 m-auto" />
      )}
    </button>
  );
};

export default ThemeToggle;
