import React, { useCallback, useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';

import initSqlJs from "sql.js";

// eslint-disable-next-line import/no-webpack-loader-syntax
// import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm";

function App() {
  const [database, setDatabase] = useState<initSqlJs.Database>();

  const initDb = useCallback(async () => {
    const SQL = await initSqlJs(
      {
        locateFile: (file) => `https://sql.js.org/dist/${file}`,
      }
    );
    const db = new SQL.Database();
    setDatabase(db);
  }, []);

  useEffect(() => {
    initDb();
  }, [initDb]);

  useEffect(() => {
    if (!database) {
      return;
    }
    database.run('CREATE TABLE test (col1, col2);');
    database.run('INSERT INTO test VALUES (?, ?);', ['Hello', 'World']);
    const res = database.exec('SELECT * FROM test');
    console.log(res);
  }, [database]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to relaod.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
