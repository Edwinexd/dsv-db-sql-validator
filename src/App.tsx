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
import logo from './logo.svg';
import './App.css';
import ResultTable from './ResultTable';

import initSqlJs from "sql.js";

function App() {
  const [database, setDatabase] = useState<initSqlJs.Database>();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('SELECT * FROM student');
  const [result, setResult] = useState<{ columns: string[], data: (number | string | Uint8Array | null)[][] } | null>(null);

  const initDb = useCallback(async () => {
    const sqlPromise = initSqlJs(
      {
        locateFile: (file) => `https://sql.js.org/dist/${file}`,
      }
    );
    const dataPromise = fetch('/data.sqlite').then((res) => res.arrayBuffer());
    const [SQL, data] = await Promise.all([sqlPromise, dataPromise]);
    const db = new SQL.Database(new Uint8Array(data));
    setDatabase(db);
  }, []);

  useEffect(() => {
    initDb();
  }, [initDb]);

  useEffect(() => {
    if (!database) {
      return;
    }
    const res = database.exec('SELECT * FROM student');
    console.log(res);
  }, [database]);

  useEffect(() => {
    if (!database) {
      return;
    }
    try {
      database.prepare(query);
      setError(null);
    } catch (e) {
      // @ts-ignore
      setError(e.message);
    }
  }, [database, query]);

  const runQuery = useCallback(() => {
    if (!database) {
      return;
    }
    try {
      const res = database.exec(query);
      if (res.length === 0) {
        return;
      }
      const { columns, values } = res[0];
      setResult({ columns, data: values });
    } catch (e) {
      // @ts-ignore
      setError(e.message);
    }
  }, [database, query]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        {error && <p>{error}</p>}
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
        <button onClick={initDb}>Reset DB</button>
        <button onClick={runQuery}>Run query</button>
        {result && <ResultTable columns={result.columns} data={result.data} />}
      </header>
    </div>
  );
}

export default App;
