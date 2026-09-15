---
title: "Сквозь Зыбь"
description: "Мини-игра — проведи флагман через 5 слоёв Мереи"
теги: [игра, эшелон]
tags: [игра, эшелон]
---

# Сквозь Зыбь

Проведи флагман через 5 слоёв Мереи. Уклоняйся от разломов, собирай кристаллы, не потеряй топливо.

<div id="echelon-wrap">
  <div id="echelon-hud">
    <span>Слой <b id="hud-layer">1</b>/5</span>
    <span>❤ <b id="hud-health">100</b></span>
    <span>⛽ <b id="hud-fuel">100</b></span>
    <span>✨ <b id="hud-faith">0</b></span>
    <span>🌑 <b id="hud-corruption">0</b></span>
  </div>
  <canvas id="echelon-canvas" width="900" height="500"></canvas>
  <div id="echelon-buttons">
    <button id="btn-start">▶ Начать</button>
    <button id="btn-fire">🔥 Огонь</button>
    <button id="btn-restart" style="display:none">↻ Заново</button>
  </div>
  <div id="echelon-result"></div>
  <div id="echelon-record"></div>
</div>

## Управление

- **WASD / стрелки** — движение флагмана
- **Палец по полю** — вести корабль к точке касания
- **Кристаллы** (золото) — топливо и вера
- **Разломы и Тлен** — здоровье и порча

## Рекорд

Смотри внизу страницы.

<script src="static/games/echelon.js"></script>
