import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import coinIcon from "../asset/coin.webp";
import backIcon from "../asset/home/back.webp";
import roomBackground from "../asset/Furniture/Avatar_Room.webp";
import { getFurniturePrice } from "../config/furnitureConfig";
import { getActiveChildId, getEconomy, purchaseFurniture } from "../utils/economyManager";
import "../styles/Furniture.css";

const assets = require.context("../asset/Furniture", false, /\.webp$/);
const COLS = 16, ROWS = 10;
const ITEMS = assets.keys().map((path) => { const id = path.slice(2, -5); return { id, name: id.replaceAll("_", " "), src: assets(path), price: getFurniturePrice(id) }; }).filter(({ id }) => id !== "Avatar_Room");
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const gridX = (col) => (clamp(col, 0, COLS - 1) + .5) * 100 / COLS;
const gridY = (row) => (clamp(row, 0, ROWS - 1) + .5) * 100 / ROWS;

export default function Furniture() {
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const childId = useMemo(getActiveChildId, []);
  const layoutKey = `avatar_room_layout_${childId}`;
  const [economy, setEconomy] = useState(() => getEconomy(childId));
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState("");
  const [layout, setLayout] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(layoutKey) || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } });

  const persist = (next) => { setLayout(next); localStorage.setItem(layoutKey, JSON.stringify(next)); };
  const place = (item) => {
    const instance = `${item.id}_${Date.now()}`;
    persist([...layout, { ...item, instance, col: 7, row: 5, x: gridX(7), y: gridY(5), width: 18, zIndex: layout.length + 2 }]);
    setSelectedId(instance); setMessage(`${item.name} 已放進房間，可拖曳或用方向鍵移動`);
  };
  const moveTo = (event, instance) => {
    const box = boardRef.current?.getBoundingClientRect(); if (!box) return;
    const col = clamp(Math.floor((event.clientX - box.left) / box.width * COLS), 0, COLS - 1);
    const row = clamp(Math.floor((event.clientY - box.top) / box.height * ROWS), 0, ROWS - 1);
    persist(layout.map((item) => item.instance === instance ? { ...item, col, row, x: gridX(col), y: gridY(row) } : item));
  };
  const move = (dx, dy) => persist(layout.map((item) => { if (item.instance !== selectedId) return item; const col = clamp(Number(item.col ?? 7) + dx, 0, COLS - 1), row = clamp(Number(item.row ?? 5) + dy, 0, ROWS - 1); return { ...item, col, row, x: gridX(col), y: gridY(row) }; }));
  const remove = () => { persist(layout.filter((item) => item.instance !== selectedId)); setSelectedId(null); };
  const buy = (item) => { const result = purchaseFurniture({ id: item.id, price: item.price, childId }); setEconomy(result.economy); setMessage(result.ok ? `已購買 ${item.name}，點一下即可擺放` : result.reason === "owned" ? "這件家具已經擁有了" : "金幣不足，再完成幾次訓練吧！"); };

  const ownedItems = ITEMS.filter((item) => economy.ownedFurniture.includes(item.id));
  return <main className="furniture-page">
    <header className="furniture-header"><button className="furniture-back" onClick={() => navigate("/avatar-room")} aria-label="完成並返回房間"><img src={backIcon} alt="" /></button><div><h1>佈置我的房間</h1><p>拖曳家具，移動時會自動對齊格子</p></div><div className="coin-balance"><img src={coinIcon} alt="金幣" /><strong>{economy.coins}</strong></div></header>
    {message && <div className="shop-message" role="status">{message}</div>}
    <section className="room-editor" ref={boardRef} aria-label="家具擺放格子">
      <img className="room-editor-bg" src={roomBackground} alt="房間" draggable="false" /><div className="placement-grid" />
      {layout.map((item) => { const key = item.instance || item.id; return <button key={key} className={`placed-item ${selectedId === key ? "selected" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width || 18}%`, zIndex: item.zIndex || 2 }} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setSelectedId(key); }} onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e, key); }} onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)} aria-label={`移動 ${item.name}`}><img src={item.src} alt={item.name} draggable="false" /></button>; })}
    </section>
    <div className="grid-controls"><button onClick={() => move(0,-1)}>↑</button><button onClick={() => move(-1,0)}>←</button><button onClick={() => move(1,0)}>→</button><button onClick={() => move(0,1)}>↓</button><button className="remove-item" onClick={remove}>移除</button></div>
    <h2 className="inventory-title">我的家具（點擊放入房間）</h2>
    <section className="furniture-grid inventory">{ownedItems.map((item) => <article className="furniture-card" key={item.id}><div className="furniture-preview"><img src={item.src} alt={item.name} /></div><h2>{item.name}</h2><button onClick={() => place(item)}>放入房間</button></article>)}{!ownedItems.length && <p className="empty-inventory">還沒有家具，從下方商店購買吧！</p>}</section>
    <h2 className="inventory-title">家具商店</h2><section className="furniture-grid">{ITEMS.map((item) => { const owned = economy.ownedFurniture.includes(item.id); return <article className="furniture-card" key={item.id}><div className="furniture-preview"><img src={item.src} alt={item.name} loading="lazy" /></div><h2>{item.name}</h2><button disabled={owned} onClick={() => buy(item)} className={owned ? "owned" : ""}>{owned ? "已擁有" : <><img src={coinIcon} alt="" />{item.price}</>}</button></article>; })}</section>
  </main>;
}
