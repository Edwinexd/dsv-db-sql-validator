import React from "react";

const insertWordBreaks = (text: string): (string | JSX.Element)[] => {
  return text
    .split(/(_|-|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=\d)(?=[a-zA-Z])|(?<=[a-zA-Z])(?=\d))/g)
    .flatMap((chunk, index) => [chunk, <wbr key={index} />])
    .slice(0, -1); // Remove last <wbr> which is unnecessary
};

interface WordBreakTextProps {
  text: string;
}

/**
 * A component that inserts word breaks into a string at camelCase, snake_case, PascalCase, kebab-case, and number boundaries.
 * 
 * @component
 * @param {Object} props - The component props
 * @param {string} props.text - The text to be displayed with word breaks
 * @returns {JSX.Element} A span element containing the text with inserted word breaks
 *
 * @example
 * ```tsx
 * <WordBreakText text="LongTextWithoutSpaces" />
 * ```
 */
const WordBreakText: React.FC<WordBreakTextProps> = ({ text }) => {
  return <span>{insertWordBreaks(text)}</span>;
};

export default WordBreakText;
