import React, { useEffect } from 'react'
import Select from 'react-select'
import questions from './questions.json'

export interface Question {
  id: number;
  description: string;
  display_sequence: string;
  result: {
    columns: string[];
    values: (string | number)[][];
  };
}


interface QuestionSelectorProps {
  onSelect: (question: Question) => void;
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ onSelect }) => {
  const [category, setCategory] = React.useState<number>(1);
  const [sequenceOptions, setSequenceOptions] = React.useState<{ value: string, label: string }[]>(questions.find(q => q.category_id === category)?.questions.map(q => { return { value: String(q.display_sequence), label: String(q.display_sequence) } }).flat() || []);
  const [sequence, setSequence] = React.useState<string>('A');

  useEffect(() => {
    const categoryObj = questions.find(q => q.category_id === category)
    if (!categoryObj) {
      return;
    }
    setSequenceOptions(categoryObj.questions.map(q => { return { value: String(q.display_sequence), label: String(q.display_sequence) } }).flat())
  }, [category])

  const options = questions.map(q => { return { value: String(q.category_id), label: String(q.display_number) } }).flat()

  return (
    <div className="flex my-3 text-xl font-semibold">
      Question: <Select options={questions.map(q => { return { value: String(q.category_id), label: String(q.display_number) } }).flat()}
        value={options.find(o => o.value === String(category))}
        onChange={(e) => {
          if (e) {
            setSequence('A');
            setCategory(Number(e.value));
            onSelect(questions.find(q => q.category_id === Number(e.value))!.questions.find(q => q.display_sequence === 'A')!);

          }
        }} className='text-black mr-3.5 ml-2.0' />
      Variant: <Select options={sequenceOptions} value={sequenceOptions.find(o => o.value === sequence)} onChange={(e) => {
        if (e) {
          setSequence(e.value);
          onSelect(questions.find(q => q.category_id === category)?.questions.find(q => q.display_sequence === e.value)!);
        }
      }} className='text-black ml-2.0' />

    </div>
  )

}
export default QuestionSelector;
