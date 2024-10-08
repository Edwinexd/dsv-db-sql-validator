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
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ onSelect }) => {
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
            // onSelect(questions.find(q => q.category_id === Number(e.value))!.questions.find(q => q.display_sequence === 'A')!);

          }
        }} className='text-black mr-3.5 ml-2.0' />
      Variant: <Select options={sequenceOptions} value={sequenceOptions.find(o => o.value === sequence)} onChange={(e) => {
        if (e) {
          setSequence(e.value);
          // onSelect(questions.find(q => q.category_id === category)?.questions.find(q => q.display_sequence === e.value)!);
        }
      }} className='text-black ml-2.0' />

    </div>
  )

}
export default QuestionSelector;
