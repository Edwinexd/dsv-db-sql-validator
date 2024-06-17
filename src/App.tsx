/*
Fully client/web side SQL validation for the database course at Stockholm University
Copyright (C) 2024 Edwin Sundberg

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { useCallback, useEffect, useState } from 'react';
import Editor from 'react-simple-code-editor';
import './App.css';
import db_scheme_dark from './db_scheme_dark.png';
import db_scheme_light from './db_scheme_light.png';
import ResultTable from './ResultTable';

import QuestionSelector, { Question } from './QuestionSelector';

// @ts-ignore
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism.css';
import { format } from 'sql-formatter';
import initSqlJs from "sql.js";
import ViewsTable from './ViewsTable';

import sha256 from 'crypto-js/sha256';
import questions from './questions.json';
import { isCorrectResult } from './utils';
import ThemeToggle from './ThemeToggle';
import useTheme from './useTheme';


// Representing a view
interface View {
  name: string;
  query: string;
}

function App() {
  const [question, setQuestion] = useState<Question>(questions[0].questions[0]);
  const [database, setDatabase] = useState<initSqlJs.Database>();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>(localStorage.getItem('questionId-' + question.id) || "SELECT * FROM student;");
  const [result, setResult] = useState<{ columns: string[], data: (number | string | Uint8Array | null)[][] } | null>(null);
  const [views, setViews] = useState<View[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const { setTheme, isDarkMode } = useTheme();
  
  
  const initDb = useCallback(async () => {
    setResult(null);
    const sqlPromise = initSqlJs(
      {
        locateFile: (file) => `/dist/sql.js/${file}`,
      }
    );
    const dataPromise = fetch('/data.sqlite').then((res) => res.arrayBuffer());
    const [SQL, data] = await Promise.all([sqlPromise, dataPromise]);
    const db = new SQL.Database(new Uint8Array(data));
    db.create_function('YEAR', (date: string) => new Date(date).getFullYear());
    db.create_function('MONTH', (date: string) => new Date(date).getMonth() + 1);
    db.create_function('DAY', (date: string) => new Date(date).getDate());
    setDatabase(db);
  }, []);

  useEffect(() => {
    initDb();
  }, [initDb]);

  useEffect(() => {
    if (!database) {
      return;
    }
    localStorage.setItem('questionId-' + question.id, query);
    // ensure that questionid is in localstorage writtenQuestions
    const writtenQuestions = localStorage.getItem('writtenQuestions');
    if (!writtenQuestions) {
      localStorage.setItem('writtenQuestions', JSON.stringify([question.id]));
    } else {
      const parsed = JSON.parse(writtenQuestions);
      if (!parsed.includes(question.id)) {
        parsed.push(question.id);
        localStorage.setItem('writtenQuestions', JSON.stringify(parsed));
      }
    }
    try {
      const stmt = database.prepare(query);
      // Needs to be called per the documentation
      stmt.free();
      setError(null);
    } catch (e) {
      // @ts-ignore
      setError(e.message);
    }
  }, [database, query, question.id]);


  const refreshViews = useCallback((upsert: boolean) => {
    if (!database) {
      return;
    }

    const res = database.exec('SELECT name, sql FROM sqlite_master WHERE type="view"');
    let fetchedViews: View[] = [];
    if (res.length !== 0) {
      const fetched = res[0].values as string[][];
      fetchedViews = fetched.map(([name, query]) => ({ name, query }));
    }

    if (upsert) {
      localStorage.setItem('views', JSON.stringify(fetchedViews));
    }

    setViews(fetchedViews);

    // Recreate missing views
    const storedViews = localStorage.getItem('views');
    if (storedViews) {
      const savedViews: View[] = JSON.parse(storedViews);
      const missingViews = savedViews.filter(
        savedView => !fetchedViews.some(fetchedView => fetchedView.name === savedView.name)
      );
      missingViews.forEach(view => {
        database.exec(view.query);
      });
      if (missingViews.length > 0) {
        refreshViews(false); // Refresh views again to update the state after recreating missing views
      }
    }
  }, [database]);

  const runQuery = useCallback(() => {
    if (!database) {
      return;
    }
    try {
      const res = database.exec(query);
      if (res.length !== 0) {
        const { columns, values } = res[0];
        setResult({ columns, data: values });
      } else {
        setResult({columns: [], data: []});
      }
      refreshViews(true);
    } catch (e) {
      // @ts-ignore
      setError(e.message);
    }
  }, [database, query, refreshViews]);

  const deleteView = useCallback((name: string) => {
    if (!database) {
      return;
    }
    database.exec(`DROP VIEW ${name}`);
    refreshViews(true);
  }, [database, refreshViews]);

  useEffect(() => {
    refreshViews(false);
  }, [database, refreshViews]);


  useEffect(() => {
    if (!result) {
      return;
    }
    if (!isCorrectResult({columns: question.result.columns, data: question.result.values}, result)) {
      setIsCorrect(false);
      return;
    }
    setIsCorrect(true);
    const correctQuestions = localStorage.getItem('correctQuestions');
    if (!correctQuestions) {
      localStorage.setItem('correctQuestions', JSON.stringify([question.id]));
    } else {
      const parsed = JSON.parse(correctQuestions);
      if (!parsed.includes(question.id)) {
        parsed.push(question.id);
        localStorage.setItem('correctQuestions', JSON.stringify(parsed));
      }
    }
  }, [result, question.result.columns, question.result.values, question.id]);

  // Save query based on question
  const loadQuery = useCallback((oldQuestion: Question, newQuestion: Question) => {
    setQuery(localStorage.getItem('questionId-' + newQuestion.id) || "SELECT * FROM student;");
  }, [setQuery]);

  const exportData = useCallback(() => {
    if (!database) {
      return;
    }
    let output = '';

    output += '-- If you need to edit your submission, do so in the application and export again.\n\n';
    output += '/* --- BEGIN DO NOT EDIT --- */\n\n';
    output += '/* --- BEGIN Validation --- */\n';
    output += '/* --- BEGIN Submission Summary --- */\n';
    const writtenQueries = localStorage.getItem('correctQuestions');
    if (writtenQueries) {
      const parsed = JSON.parse(writtenQueries);
      const questionsString = parsed.map((id: number) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const question = category.questions.find(q => q.id === id)!;
        return `${category.display_number}${question.display_sequence}`;
      }).sort().join(', ');
      output += `/* Written Questions: ${questionsString} */\n`;
    }
    output += '/* --- END Submission Summary --- */\n';
    if (views.length > 0) {
      output += '/* --- BEGIN Views --- */\n';
      const viewsString = views.map(view => format(view.query, {
        language: 'sqlite',
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'upper',
        dataTypeCase: 'upper',
        functionCase: 'upper',
      }) + (view.query.endsWith(';') ? '' : ';')).join('\n\n');
      output += viewsString + '\n';
      output += '/* --- END Views --- */\n\n';
    }
    output += '/* --- BEGIN Submission Queries --- */\n';

    const queries = localStorage.getItem('correctQuestions');
    if (queries) {
      const parsed = JSON.parse(queries);
      const questionQueries = parsed.map((id: number) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const question = category.questions.find(q => q.id === id)!;
        const activeQuery = localStorage.getItem('questionId-' + id);
        if (!activeQuery) {
          return '';
        }
        let formatted = `/* --- BEGIN Question ${category.display_number}${question.display_sequence} (REFERENCE: ${question.id}) --- */\n`;
        formatted += format(activeQuery + (activeQuery.endsWith(';') ? '' : ';'), {
          language: 'sqlite',
          tabWidth: 2,
          useTabs: false,
          keywordCase: 'upper',
          dataTypeCase: 'upper',
          functionCase: 'upper',
        });
        formatted += `\n/* --- END Question ${category.display_number}${question.display_sequence} --- */\n`;
        return formatted;
      }).join('\n\n');
      output += questionQueries;
    }
    output += '/* --- END Submission Queries --- */\n';


    output += '/* --- END Validation --- */\n';
    // Calculate hash of everything within the validation block
    const hashValue = sha256(output.slice(output.indexOf('/* --- BEGIN Validation Block --- */'), output.indexOf('/* --- END Validation Block --- */')));
    output += `/* --- BEGIN Hash --- */\n-- ${hashValue}\n/* --- END Hash --- */\n`;
    output += '/* --- END DO NOT EDIT --- */\n\n';
    output += '-- NOTE: The following (Raw Queries, Raw List Dumps) blocks is not part of the submission but used for importing data, may be removed for submission\n';
    output += '/* --- BEGIN Raw Queries --- */\n';
    output += '/*\n'
    const allQueries = localStorage.getItem('writtenQuestions');
    if (allQueries) {
      const parsed = JSON.parse(allQueries);
      const queries: { [key: number]: string } = {};
      for (const id of parsed) {
        const activeQuery = localStorage.getItem('questionId-' + id);
        if (!activeQuery) {
          continue;
        }
        queries[id] = activeQuery;
      }
      output += JSON.stringify(queries, null, 0).replace(/\*\//g, '\\*/');
    }
    output += '\n*/\n'
    output += '/* --- END Raw Queries --- */\n';
    output += '/* --- BEGIN Raw List Dumps --- */\n';
    output += '-- ' + (localStorage.getItem('writtenQuestions') === null ? '[]' : localStorage.getItem('writtenQuestions')) + '\n';
    output += '-- ' + (localStorage.getItem('correctQuestions') === null ? '[]' : localStorage.getItem('correctQuestions')) + '\n';
    output += '/* --- END Raw List Dumps --- */\n';

    const blob = new Blob([output], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "export.sql";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }, [database, views]);



  return (
    <div className="App">
      <header className="App-header">
        <div className='my-2'></div>
        <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode}></ThemeToggle>
        <h1 className='text-6xl font-semibold my-3'>DB SQL Validator</h1>
        <img src={isDarkMode() ? db_scheme_dark : db_scheme_light} className="DB-Layout" alt="Database Layout" />
        <QuestionSelector onSelect={(selectedQuestion) => {loadQuery(question, selectedQuestion); setResult(null); setQuestion(selectedQuestion)}}></QuestionSelector>
        <p className='break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2'>{question.description}</p>
        <Editor
          value={query}
          onValueChange={code => setQuery(code)}
          highlight={code => highlight(code, languages.sql)}
          padding={10}
          tabSize={4}
          className="font-mono text-3xl w-full max-w-4xl dark:bg-slate-800 bg-slate-200 border-2 min-h-40 border-black dark:border-white"
        />
        
        {error && <p className='font-mono text-red-500 max-w-4xl break-all'>{error}</p>}
        <div className='flex text-white font-semibold text-base '>
          <button onClick={runQuery} disabled={!(error === null)} className='bg-blue-500 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xl font-semibold py-2 px-4 my-3.5 rounded mr-3 w-40' type='submit'>Run Query</button>
          <button onClick={() => {
          setQuery(format(query, {
            language: 'sqlite',
            tabWidth: 2,
            useTabs: false,
            keywordCase: 'upper',
            dataTypeCase: 'upper',
            functionCase: 'upper',
        }))}} disabled={!(error === null)} className='bg-blue-500 hover:bg-blue-700 disabled:bg-blue-300 ptext-white text-xl font-semibold y-2 px-4 my-3.5 rounded mr-3 w-40' type='submit'>Format Code</button>
        </div>
        
        <ViewsTable views={views} onRemoveView={(name) => deleteView(name)} />
        <div className='flex text-base'>
          <button onClick={() => {
            if (window.confirm('Are you sure you want to reset the database?\n\nNote: This will not reset your written answers.')) {
              initDb();
            }
            }} className='bg-red-500 hover:bg-red-700 text-white text-xl font-semibold py-2 px-4 my-4 rounded mr-3 w-40' type='submit'>Reset DB</button>
          <button onClick={exportData} className='bg-blue-500 hover:bg-blue-700 text-white text-xl font-semibold py-2 px-4 my-4 rounded mr-3 w-40' type='submit'>Export Data</button>
        </div>
        

        {result && <>
          {/* if correct result else display wrong result */}
          {isCorrect ? <>
            <h2 className="text-3xl font-semibold text-green-500">Matching Result!</h2>
            <p className="break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2 italic">... but it may not be correct! Make sure that all joins are complete and that the query only uses information from the assignment before exporting.</p>
            </> : <h2 className="text-3xl font-semibold text-red-500">Wrong result!</h2>
          }
          {/* Two different result tables next to each other, actual and expected */}
          <div className="flex max-w-full py-4 justify-center">
            <div className="flex-initial px-2 overflow-x-auto">
              <h2 className="text-3xl font-semibold py-2">Actual</h2>
              <div className="overflow-x-auto max-w-full">
                <ResultTable columns={result.columns} data={result.data} />
              </div>
            </div>
            <div className="flex-initial px-2 overflow-x-auto">
              <h2 className="text-3xl font-semibold py-2">Expected</h2>
              <div className="overflow-x-auto max-w-full">
                <ResultTable columns={question.result.columns} data={question.result.values} />
              </div>
            </div>
          </div>
        </>}
        <footer className="text-lg py-4 my-3">
          <div className="container mx-auto flex justify-between items-center space-x-8">
            <p>Copyright &copy; <a href="https://github.com/Edwinexd" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Edwin Sundberg</a> {new Date().getFullYear()} - All Rights Reserved</p>              
            <p><a href="https://github.com/Edwinexd/dsv-db-sql-validator/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Report issues</a></p>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;
