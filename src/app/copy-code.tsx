'use client';import {useState} from 'react';
export default function CopyCode({text}:{text:string}){const[state,setState]=useState('Copy');return<div className="av-code-wrap"><pre><code>{text}</code></pre><button onClick={async()=>{try{await navigator.clipboard.writeText(text);setState('Copied ✓');}catch{setState('Select text to copy');}}}>{state}</button></div>;}
