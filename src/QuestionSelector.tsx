import React, { useEffect } from 'react'
import Select from 'react-select'
import questions from './questions.json'
import { Result } from './utils';

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
            setSequence('A');
            setCategory(Number(e.value));
          }
        }} 
        className='text-black mr-3.5 ml-2'
        // classNames={{
        //   option: ({ data, isDisabled }) => {
        //     // data.value points to a category
        //     const categoryObj = questions.find(q => q.category_id === Number(data.value))!;
        //     // if any of the questions in the category are correct, green blob highlight
        //     if (categoryObj.questions.some(q => correctQuestions && correctQuestions.includes(q.id))) {
        //       return "!bg-green-100 text-green-800 py-1 rounded";
        //     }
        //     return "!bg-red-100 text-red-800 py-1 rounded p-1";
        //   },
        // }}
        components={{ Option: (props) => {
          const {
            children,
            className,
            cx,
            isDisabled,
            isFocused,
            isSelected,
            innerRef,
            innerProps,
            data,
          } = props;

          const categoryObj = questions.find(q => q.category_id === Number(data.value))!;

          const isCorrect = correctQuestions && categoryObj.questions.some(q => correctQuestions.includes(q.id));
          const isWritten = !isCorrect && writtenQuestions && categoryObj.questions.some(q => writtenQuestions.includes(q.id));

          return (
            <div
              ref={innerRef}
              className={cx(
              {
                option: true,
                'option--is-disabled': isDisabled,
                'option--is-focused': isFocused,
                'option--is-selected': isSelected,
              },
              className,
              isFocused && !isSelected ? "bg-blue-200" : "",
              isSelected ? "bg-blue-500 focus:bg-blue-700 text-white" : "",
              "p-2"
              )}
              {...innerProps}
            >
              {isCorrect && <span className={"bg-green-200 bg-opacity-75 text-black px-2 p-0.5 rounded"}>
                {children}
              </span>}
              {isWritten && <span className={"bg-yellow-200 bg-opacity-75 text-black px-2 p-0.5 rounded"}>
                {children}
              </span>}
              {!isCorrect && !isWritten &&
              <span>
                {children}
              </span>}
            </div>
          );
        }}}
        
      />
      Variant: <Select options={sequenceOptions} value={sequenceOptions.find(o => o.value === sequence)} onChange={(e) => {
        if (e) {
          setSequence(e.value);
        }
      }} className='text-black ml-2'
      components={{
        Option: (props) => {
          const {
            children,
            className,
            cx,
            isDisabled,
            isFocused,
            isSelected,
            innerRef,
            innerProps,
            data,
          } = props;

          const question = questions.find(q => q.category_id === category)!.questions.find(q => q.display_sequence === data.value)!;
          const isCorrect = correctQuestions && correctQuestions.includes(question.id);
          const isWritten = !isCorrect && writtenQuestions && writtenQuestions.includes(question.id);

          return (
            <div
              ref={innerRef}
              className={cx(
                {
                  option: true,
                  'option--is-disabled': isDisabled,
                  'option--is-focused': isFocused,
                  'option--is-selected': isSelected,
                },
                className,
                isFocused && !isSelected ? "bg-blue-200" : "",
                isSelected ? "bg-blue-500 focus:bg-blue-700 text-white" : "",
                "p-2"
              )}
              {...innerProps}
            >
              {isCorrect && <span className={"bg-green-200 bg-opacity-75 text-black px-2 p-0.5 rounded"}>
                {children}
              </span>}
              {isWritten && <span className={"bg-yellow-200 bg-opacity-75 text-black px-2 p-0.5 rounded"}>
                {children}
              </span>}
              {!isCorrect && !isWritten &&
              <span>
                {children}
              </span>}
            </div>
          );
        }
      }}
      />

    </div>
  )

}
export default QuestionSelector;
