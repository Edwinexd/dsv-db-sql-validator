import React from 'react'
import Select from 'react-select'

const AlphabeticalOptions = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'G', label: 'G' },
  { value: 'H', label: 'H' },
]

const NumeralOptions = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
    { value: '6', label: '6' },
    { value: '7', label: '7' },
    { value: '8', label: '8' },
    { value: '9', label: '9' },
    { value: '10', label: '10'},
    { value: '11', label: '11'},
    { value: '12', label: '12'},
    { value: '13', label: '13'},
    { value: '14', label: '14'},
    { value: '15', label: '15'},
    { value: '16', label: '16'},
    { value: '17', label: '17'},
]

const AlphabeticalBox = () => (
  <Select options={AlphabeticalOptions} />
  
)

const NumeralBox = () => (
    <Select options={NumeralOptions} />
)


interface QuestionSelectorProps {
    onSelect: (id: number) => void;
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({onSelect}) => {
    return (<div className="flex mb-5 text-3xl font-semibold">Question:<Select options={NumeralOptions} className='text-black mr-3.5 ml-2.0 '/> Subtype:
    <Select options={AlphabeticalOptions} className='text-black	mr-3.5 ml-2.0' /></div>)

}
export default QuestionSelector;