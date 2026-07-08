import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import roomBackground from "../asset/Avatar_Room.png";
import furnitureIcon from "../asset/home/Furniture.png";
import achievementIcon from "../asset/home/goal.png";
import backHomeIcon from "../asset/home/backhome.png";

/**
 * 角色小屋
 *
 * 目前房間初始不放置任何家具。
 * 之後 Furniture.jsx 可將已選擇的家具資料存入 localStorage：
 * avatar_room_layout_${childId}
 *
 * 範例：
 * [
 *   {
 *     "id": "bed01",
 *     "src": "/src/asset/Furniture/bed01.png",
 *     "x": 12,
 *     "y": 58,
 *     "width": 24
 *   }
 * ]
 */
function AvatarRoom() {
  const navigate = useNavigate();

  const childId = useMemo(() => {
    try {
      const session = JSON.parse(localStorage.getItem("currentChild") || "null");
      return (
        session?.id ||
        session?.childId ||
        localStorage.getItem("childId") ||
        "default"
      );
    } catch {
      return localStorage.getItem("childId") || "default";
    }
  }, []);

  const placedFurniture = useMemo(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`avatar_room_layout_${childId}`) || "[]"
      );

      if (!Array.isArray(saved)) return [];

      // 帽子不屬於房間家具，不在角色小屋內顯示。
      return saved.filter((item) => {
        const value = `${item?.id || ""} ${item?.type || ""} ${
          item?.src || ""
        }`.toLowerCase();
        return !value.includes("cap") && !value.includes("hat");
      });
    } catch {
      return [];
    }
  }, [childId]);

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <main style={styles.page} aria-label="角色小屋">
      <img
        src={roomBackground}
        alt="角色小屋背景"
        draggable="false"
        style={styles.background}
      />

      <section style={styles.roomLayer} aria-label="已擺放的家具">
        {placedFurniture.map((item, index) => (
          <img
            key={item.id || `${item.src}-${index}`}
            src={item.src}
            alt={item.name || "已擺放家具"}
            draggable="false"
            style={{
              ...styles.furniture,
              left: `${Number(item.x ?? 50)}%`,
              top: `${Number(item.y ?? 50)}%`,
              width: `${Number(item.width ?? 18)}%`,
              zIndex: Number(item.zIndex ?? index + 2),
              transform: `translate(-50%, -50%) rotate(${Number(
                item.rotate ?? 0
              )}deg)`,
            }}
          />
        ))}
      </section>

      <nav style={styles.bottomMenu} aria-label="角色小屋功能">
        <button
          type="button"
          onClick={() => handleNavigate("/achievement")}
          style={styles.iconButton}
          aria-label="查看成就"
        >
          <img
            src={achievementIcon}
            alt="成就"
            draggable="false"
            style={styles.bottomIcon}
          />
        </button>

        <button
          type="button"
          onClick={() => handleNavigate("/furniture")}
          style={styles.iconButton}
          aria-label="開啟傢俱"
        >
          <img
            src={furnitureIcon}
            alt="傢俱"
            draggable="false"
            style={styles.bottomIcon}
          />
        </button>
      </nav>

      <button
        type="button"
        onClick={() => handleNavigate("/game-menu")}
        style={{ ...styles.iconButton, ...styles.backButton }}
        aria-label="回到森林"
      >
        <img
          src={backHomeIcon}
          alt="回到森林"
          draggable="false"
          style={styles.backIcon}
        />
      </button>
    </main>
  );
}

const styles = {
  page: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    minHeight: "520px",
    overflow: "hidden",
    backgroundColor: "#f6cf8c",
    userSelect: "none",
  },
  background: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none",
  },
  roomLayer: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "none",
  },
  furniture: {
    position: "absolute",
    height: "auto",
    maxHeight: "58%",
    objectFit: "contain",
    filter: "drop-shadow(0 8px 8px rgba(90, 48, 12, 0.24))",
    pointerEvents: "none",
  },
  bottomMenu: {
    position: "absolute",
    left: "4%",
    bottom: "7%",
    zIndex: 20,
    display: "flex",
    alignItems: "flex-end",
    gap: "clamp(10px, 1.5vw, 22px)",
  },
  iconButton: {
    margin: 0,
    padding: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "transform 160ms ease, filter 160ms ease",
  },
  bottomIcon: {
    display: "block",
    width: "clamp(82px, 8.3vw, 132px)",
    height: "auto",
    objectFit: "contain",
    filter: "drop-shadow(0 5px 4px rgba(82, 41, 13, 0.25))",
  },
  backButton: {
    position: "absolute",
    top: "7%",
    right: "5%",
    zIndex: 20,
  },
  backIcon: {
    display: "block",
    width: "clamp(165px, 15vw, 250px)",
    height: "auto",
    objectFit: "contain",
    filter: "drop-shadow(0 5px 5px rgba(82, 41, 13, 0.25))",
  },
};

export default AvatarRoom;
