import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor from 'react-simple-code-editor';
import './App.css';
import logo from './logo.svg';

import Prism from 'prismjs';
// @ts-ignore
import { highlight, languages } from 'prismjs/components/prism-core';
import initSqlJs from "sql.js";
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism.css';



//eslint-disable-next-line import/no-webpack-loader-syntax
//import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm";

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

  const Component = () => {
    
    const [code, setCode] = React.useState(
      `function add(a, b) {\n  return a + b;\n}`
    );
    return (
      <Editor
        value={code}
        onValueChange={code => setCode(code)}
        highlight={code => highlight(code, languages.sql)}
        padding={10}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 12,
        }}
      />
    );
  };

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
        <Component></Component>
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
      </header>
    </div>
  );
}

export default App;
