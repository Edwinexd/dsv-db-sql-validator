import React, { useEffect } from "react"
import Select from "react-select"
import questions from "./questions.json"
import { Result } from "./utils";

export interface Category {
  id: number;
  display_number: string;
}

export interface Question {
  category: Category;
  id: number;
  description: string;
  display_sequence: string;
  result: {
    columns: string[];
    values: (string | number)[][];
  };
  evaluable_result: Result;
}

interface QuestionSelectorProps {
  onSelect: (question: Question) => void;
  writtenQuestions?: number[];
  correctQuestions?: number[];
}

interface HighlightProps {
  isCorrect: boolean;
  isWritten: boolean;
  children: React.ReactNode;
}

interface HighlightBaseProps {
  dataValue: string;
  isCategory: boolean;
  category?: number;
  correctQuestions?: number[];
  writtenQuestions?: number[];
  children: React.ReactNode;
}

interface HighlightedOptionProps extends HighlightBaseProps {
  className?: string;
  isDisabled?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
  innerProps?: React.HTMLAttributes<HTMLDivElement>;
}

type HighlightedSingleValueProps = HighlightBaseProps;

const HighlightWrapper: React.FC<HighlightProps> = ({ isCorrect, isWritten, children }) => {
  if (isCorrect) {
    return <span className="bg-green-200 bg-opacity-75 text-black px-2 p-0.5 rounded">{children}</span>;
  }
  if (isWritten) {
    return <span className="bg-yellow-200 bg-opacity-75 text-black px-2 p-0.5 rounded">{children}</span>;
  }
  return <span className="px-2 p-0.5">{children}</span>;
};


const useHighlightLogic = (
  dataValue: string,
  isCategory: boolean,
  category: number | undefined,
  correctQuestions?: number[],
  writtenQuestions?: number[]
) => {
  let isCorrect = false;
  let isWritten = false;

  if (isCategory) {
    const categoryObj = questions.find(q => q.category_id === Number(dataValue));
    if (categoryObj) {
      isCorrect = correctQuestions?.some(id => categoryObj.questions.some(q => q.id === id)) || false;
      isWritten = !isCorrect && (writtenQuestions?.some(id => categoryObj.questions.some(q => q.id === id)) || false);
    }
  } else if (category !== undefined) {
    const question = questions
      .find(q => q.category_id === category)
      ?.questions.find(q => q.display_sequence === dataValue);
    if (question) {
      isCorrect = correctQuestions?.includes(question.id) || false;
      isWritten = !isCorrect && (writtenQuestions?.includes(question.id) || false);
    }
  }

  return { isCorrect, isWritten };
};

const HighlightedOption: React.FC<HighlightedOptionProps> = ({
  dataValue,
  isCategory,
  category,
  correctQuestions,
  writtenQuestions,
  children,
  className,
  isDisabled: _isDisabled,
  isFocused,
  isSelected,
  innerRef,
  innerProps,
}) => {
  const { isCorrect, isWritten } = useHighlightLogic(dataValue, isCategory, category, correctQuestions, writtenQuestions);

  return (
    <div
      ref={innerRef}
      className={`${className} ${isFocused && !isSelected ? "bg-blue-200" : ""} ${isSelected ? "bg-blue-500 focus:bg-blue-700 text-white" : ""} p-2`}
      {...innerProps}
    >
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {children}
      </HighlightWrapper>
    </div>
  );
};

const HighlightedSingleValue: React.FC<HighlightedSingleValueProps> = ({
  dataValue,
  isCategory,
  category,
  correctQuestions,
  writtenQuestions,
  children,
}) => {
  const { isCorrect, isWritten } = useHighlightLogic(dataValue, isCategory, category, correctQuestions, writtenQuestions);

  return (
    <div className="text-black col-start-1 col-end-3 row-start-1 row-end-2">
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {children}
      </HighlightWrapper>
    </div>
  );
};

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ onSelect, writtenQuestions, correctQuestions }) => {
  const [category, setCategory] = React.useState<number>();
  const [sequenceOptions, setSequenceOptions] = React.useState<{ value: string, label: string }[]>([]);
  const [sequence, setSequence] = React.useState<string>();
  const [question, setQuestion] = React.useState<Question>();

  useEffect(() => {
    const categoryObj = questions.find(q => q.category_id === category)
    if (!categoryObj) {
      return;
    }
    setSequenceOptions(categoryObj.questions.map(q => { return { value: String(q.display_sequence), label: String(q.display_sequence) } }).flat())
  }, [category])

  useEffect(() => {
    if (!category) {
      return;
    }

    if (question && question.display_sequence === sequence && question.category.id === category) {
      return;
    }
    const categoryObj = questions.find(q => q.category_id === category)
    if (!categoryObj) {
      return;
    }
    const rawQuestionObj = categoryObj.questions.find(q => q.display_sequence === sequence)
    if (!rawQuestionObj) {
      return;
    }

    const questionObj = {...rawQuestionObj, category: { id: category, display_number: String(category) }, evaluable_result: { columns: rawQuestionObj.result.columns, data: rawQuestionObj.result.values } }
    setQuestion(questionObj);
    onSelect(questionObj);
  }, [sequence, category, question, onSelect])

  const options = questions.map(q => { return { value: String(q.category_id), label: String(q.display_number) } }).flat()

  return (
    <div className="flex my-3 text-xl font-semibold">
      Question: <Select options={questions.map(q => { return { value: String(q.category_id), label: String(q.display_number) } }).flat()}
        value={options.find(o => o.value === String(category))}
        onChange={(e) => {
          if (e) {
            setSequence("A");
            setCategory(Number(e.value));
          }
        }} 
        className="text-black mr-3.5 ml-2"
        components={{
          Option: (props) => (
            <HighlightedOption
              {...props}
              // I'm not quite sure why this error is happening, something seems wrong in react-select?
              // eslint-disable-next-line react/prop-types
              dataValue={props.data.value}
              isCategory={true}
              correctQuestions={correctQuestions}
              writtenQuestions={writtenQuestions}
            />
          ),
          SingleValue: (props) => (
            <HighlightedSingleValue
              {...props}
              // I'm not quite sure why this error is happening, something seems wrong in react-select?
              // eslint-disable-next-line react/prop-types
              dataValue={props.data.value}
              isCategory={true}
              correctQuestions={correctQuestions}
              writtenQuestions={writtenQuestions}
            />
          ),
        }}
        
      />
      Variant: <Select options={sequenceOptions} value={sequenceOptions.find(o => o.value === sequence)} onChange={(e) => {
        if (e) {
          setSequence(e.value);
        }
      }} className="text-black ml-2"
      components={{
        Option: (props) => (
          <HighlightedOption
            {...props}
            // I'm not quite sure why this error is happening, something seems wrong in react-select?
            // eslint-disable-next-line react/prop-types
            dataValue={props.data.value}
            isCategory={false}
            category={category}
            correctQuestions={correctQuestions}
            writtenQuestions={writtenQuestions}
          />
        ),
        SingleValue: (props) => (
          <HighlightedSingleValue
            {...props}
            // I'm not quite sure why this error is happening, something seems wrong in react-select?
            // eslint-disable-next-line react/prop-types
            dataValue={props.data.value}
            isCategory={false}
            category={category}
            correctQuestions={correctQuestions}
            writtenQuestions={writtenQuestions}
          />
        ),
      }}
      />

    </div>
  )

}
export default QuestionSelector;
