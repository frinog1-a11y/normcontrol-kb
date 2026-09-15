import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  zoomIdentity,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle } from "pixi.js"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

type GraphicsInfo = {
  color: string
  gfx: Graphics
  alpha: number
  active: boolean
}

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
} & SimulationNodeDatum

type SimpleLinkData = {
  source: SimpleSlug
  target: SimpleSlug
}

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type LinkRenderData = GraphicsInfo & {
  simulationData: LinkData
}

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData
  label: Text
}

// PATCH (normcontrol-kb): параметры анимаций графа
const HUB_LINKS = 5
const APPEAR_MS = 600
const ZOOM_TO_NODE_MS = 300
const SWAY_STEP = 0.005
const SWAY_AMPLITUDE = 0.5
const PULL_DISTANCE = 4

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}

function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

type TweenNode = {
  update: (time: number) => void
  stop: () => void
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  const visited = getVisited()
  removeAllChildren(graph)

  let {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
    removeTags,
    showTags,
    focusOnHover,
    enableRadial,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  const validLinks = new Set(data.keys())

  const tweens = new Map<string, TweenNode>()
  for (const [source, details] of data.entries()) {
    const outgoing = details.links ?? []

    for (const dest of outgoing) {
      if (validLinks.has(dest)) {
        links.push({ source: source, target: dest })
      }
    }

    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))

      tags.push(...localTags.filter((tag) => !tags.includes(tag)))

      for (const tag of localTags) {
        links.push({ source: source, target: tag })
      }
    }
  }

  const neighbourhood = new Set<SimpleSlug>()
  const wl: (SimpleSlug | "__SENTINEL")[] = [slug, "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()!
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbourhood.add(cur)
        const outgoing = links.filter((l) => l.source === cur)
        const incoming = links.filter((l) => l.target === cur)
        wl.push(...outgoing.map((l) => l.target), ...incoming.map((l) => l.source))
      }
    }
  } else {
    validLinks.forEach((id) => neighbourhood.add(id))
    if (showTags) tags.forEach((tag) => neighbourhood.add(tag))
  }

  const nodes = [...neighbourhood].map((url) => {
    const text = url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url)
    return {
      id: url,
      text,
      tags: data.get(url)?.tags ?? [],
    }
  })
  const graphData: { nodes: NodeData[]; links: LinkData[] } = {
    nodes,
    links: links
      .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
      .map((l) => ({
        source: nodes.find((n) => n.id === l.source)!,
        target: nodes.find((n) => n.id === l.target)!,
      })),
  }

  // PATCH (normcontrol-kb): the height already falls back to 250px, the width did not — a
  // container that has no layout yet (hidden / still measuring) produced a 0px wide canvas,
  // which renders nothing and cannot be clicked or dragged.
  const width = Math.max(graph.offsetWidth, 250)
  const height = Math.max(graph.offsetHeight, 250)

  // we virtualize the simulation and use pixi to actually render it
  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(graphData.nodes)
    .force("charge", forceManyBody().strength(-100 * repelForce))
    .force("center", forceCenter().strength(centerForce))
    .force("link", forceLink(graphData.links).distance(linkDistance))
    // PATCH (normcontrol-kb): фиксированный радиус столкновения 12 — узлы не слипаются
    .force("collide", forceCollide<NodeData>(12).iterations(3))

  const radius = (Math.min(width, height) / 2) * 0.8
  if (enableRadial) simulation.force("radial", forceRadial(radius).strength(0.2))

  // PATCH (normcontrol-kb): категория узла — по папке базы; у ошибок и документов — по подпапке.
  const catKey = (id: string) => {
    const parts = id.split("/")
    if ((parts[0] === "02_Ошибки" || parts[0] === "04_Документы") && parts.length > 1) {
      return parts[0] + "/" + parts[1]
    }
    return parts[0]
  }

  // PATCH (normcontrol-kb): мягкая кластеризация — категории притягиваются к своим якорям
  if (!enableRadial) {
    const catKeys = [...new Set(graphData.nodes.map((n) => catKey(n.id)))].sort()
    const anchors = new Map<string, { x: number; y: number }>()
    catKeys.forEach((key, i) => {
      const angle = (i / catKeys.length) * Math.PI * 2
      anchors.set(key, { x: Math.cos(angle) * radius * 0.55, y: Math.sin(angle) * radius * 0.55 })
    })
    const clusterForce = (alpha: number) => {
      const strength = 0.06 * alpha
      for (const node of graphData.nodes) {
        const anchor = anchors.get(catKey(node.id))
        if (!anchor) continue
        node.vx = (node.vx ?? 0) + (anchor.x - (node.x ?? 0)) * strength
        node.vy = (node.vy ?? 0) + (anchor.y - (node.y ?? 0)) * strength
      }
    }
    simulation.force("cluster", clusterForce)
  }

  // precompute style prop strings as pixi doesn't support css variables
  const cssVars = [
    "--secondary",
    "--tertiary",
    "--gray",
    "--light",
    "--lightgray",
    "--dark",
    "--darkgray",
    "--bodyFont",
  ] as const
  const computedStyleMap = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  // Палитра узлов задаётся функцией getNodeColor ниже

  // PATCH (normcontrol-kb): цвета узлов по разделам базы — единая «астральная» палитра
  const getNodeColor = (slug: string) => {
    if (slug.includes("02_Ошибки")) return "#a85a7a"
    if (slug.includes("03_ГОСТы")) return "#7a6a9a"
    if (slug.includes("04_Документы")) return "#5a7a7a"
    if (slug.includes("05_Элементы")) return "#8a7ab8"
    if (slug.includes("99_Шаблоны")) return "#a88858"
    return "#8a80a0"
  }

  // PATCH (normcontrol-kb): заранее считаем степени узлов, соседей и хабы —
  // нужно для анимаций, чтобы не пересчитывать связи в каждом кадре
  const linkDegrees = new Map<string, number>()
  const neighbourIds = new Map<string, Set<string>>()
  for (const node of graphData.nodes) {
    linkDegrees.set(node.id, 0)
    neighbourIds.set(node.id, new Set())
  }
  for (const l of graphData.links) {
    linkDegrees.set(l.source.id, (linkDegrees.get(l.source.id) ?? 0) + 1)
    linkDegrees.set(l.target.id, (linkDegrees.get(l.target.id) ?? 0) + 1)
    neighbourIds.get(l.source.id)?.add(l.target.id)
    neighbourIds.get(l.target.id)?.add(l.source.id)
  }
  const hubIds = new Set(
    [...linkDegrees.entries()].filter(([, degree]) => degree >= HUB_LINKS).map(([id]) => id),
  )
  const nodesById = new Map(graphData.nodes.map((node) => [node.id, node]))
  const appearDelays = new Map<string, number>()
  const appearStart = performance.now()

  // calculate color
  const color = (d: NodeData) => {
    const isCurrent = d.id === slug
    if (isCurrent) {
      return computedStyleMap["--secondary"]
    } else if (d.id.startsWith("tags/")) {
      return computedStyleMap["--tertiary"]
    } else {
      // PATCH (normcontrol-kb): цвет узла — по разделу базы (астральная палитра)
      return getNodeColor(d.id)
    }
  }

  function linkCount(d: NodeData) {
    return graphData.links.filter((l) => l.source.id === d.id || l.target.id === d.id).length
  }

  // PATCH (normcontrol-kb): размер узла — min(6, 2 + sqrt(связей))
  function nodeRadius(d: NodeData) {
    return Math.min(6, 2 + Math.sqrt(linkCount(d)))
  }

  let hoveredNodeId: string | null = null
  let hoveredNeighbours: Set<string> = new Set()
  const linkRenderData: LinkRenderData[] = []
  const nodeRenderData: NodeRenderData[] = []
  function updateHoverInfo(newHoveredId: string | null) {
    hoveredNodeId = newHoveredId

    if (newHoveredId === null) {
      hoveredNeighbours = new Set()
      for (const n of nodeRenderData) {
        n.active = false
      }

      for (const l of linkRenderData) {
        l.active = false
      }
    } else {
      hoveredNeighbours = new Set()
      for (const l of linkRenderData) {
        const linkData = l.simulationData
        if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
          hoveredNeighbours.add(linkData.source.id)
          hoveredNeighbours.add(linkData.target.id)
        }

        l.active = linkData.source.id === newHoveredId || linkData.target.id === newHoveredId
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id)
      }
    }
  }

  let dragStartTime = 0
  let dragging = false

  function renderLinks() {
    tweens.get("link")?.stop()
    const tweenGroup = new TweenGroup()

    for (const l of linkRenderData) {
      // PATCH (normcontrol-kb): в покое связи полупрозрачные, при наведении активные ярче
      let alpha = hoveredNodeId ? (l.active ? 0.9 : 0.06) : 0.22

      l.color = l.active ? computedStyleMap["--gray"] : computedStyleMap["--lightgray"]
      tweenGroup.add(new Tweened<LinkRenderData>(l).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("link", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderLabels() {
    tweens.get("label")?.stop()
    const tweenGroup = new TweenGroup()

    const defaultScale = 1 / scale
    const activeScale = defaultScale * 1.1
    for (const n of nodeRenderData) {
      const nodeId = n.simulationData.id

      // PATCH (normcontrol-kb): подписи показываются и у соседей узла под курсором
      if (hoveredNodeId === nodeId || (hoveredNodeId !== null && hoveredNeighbours.has(nodeId))) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        )
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: n.label.alpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("label", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderNodes() {
    tweens.get("hover")?.stop()

    const tweenGroup = new TweenGroup()
    for (const n of nodeRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      if (hoveredNodeId !== null && focusOnHover) {
        alpha = n.active ? 1 : 0.15
      }

      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("hover", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderPixiFromD3() {
    renderNodes()
    renderLinks()
    renderLabels()
  }

  tweens.forEach((tween) => tween.stop())
  tweens.clear()

  const app = new Application()
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  })
  graph.appendChild(app.canvas)

  const stage = app.stage
  stage.interactive = false

  const labelsContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true })
  const nodesContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true })
  const linkContainer = new Container<Graphics>({ zIndex: 1, isRenderGroup: true })
  stage.addChild(nodesContainer, labelsContainer, linkContainer)

  let appearCounter = 0
  for (const n of graphData.nodes) {
    const nodeId = n.id

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: n.text,
      // PATCH (normcontrol-kb): подписи скрыты по умолчанию — показываются только при наведении
      alpha: 0,
      anchor: { x: 0.5, y: 1.2 },
      style: {
        fontSize: fontSize * 15,
        fill: computedStyleMap["--dark"],
        fontFamily: computedStyleMap["--bodyFont"],
      },
      resolution: window.devicePixelRatio * 4,
    })
    label.scale.set(1 / scale)
    // PATCH (normcontrol-kb): «волна» появления — задержка по порядку узлов
    appearDelays.set(nodeId, Math.min(appearCounter * 8, APPEAR_MS))
    appearCounter++

    let oldLabelOpacity = 0
    const isTagNode = nodeId.startsWith("tags/")
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Circle(0, 0, nodeRadius(n)),
      cursor: "pointer",
    })
      .circle(0, 0, nodeRadius(n))
      .fill({ color: isTagNode ? computedStyleMap["--light"] : color(n) })
      .on("pointerover", (e) => {
        updateHoverInfo(e.target.label)
        oldLabelOpacity = label.alpha
        // масштаб узла под курсором ведёт animate (чтобы не конфликтовать с пульсацией хабов)
        if (!dragging) {
          renderPixiFromD3()
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(null)
        label.alpha = oldLabelOpacity
        if (!dragging) {
          renderPixiFromD3()
        }
      })

    if (isTagNode) {
      gfx.stroke({ width: 2, color: computedStyleMap["--tertiary"] })
    } else if (visited.has(n.id)) {
      // PATCH (normcontrol-kb): уже просмотренные заметки помечаем тонкой обводкой
      gfx.stroke({ width: 1, color: computedStyleMap["--secondary"] })
    } else {
      // PATCH (normcontrol-kb): лёгкая обводка, чтобы узел читался на светлом фоне
      gfx.stroke({ width: 1, color: "rgba(46, 40, 64, 0.25)" })
    }

    // PATCH (normcontrol-kb): старт «волны» появления — масштаб и прозрачность ведёт animate
    gfx.scale.set(0.01)
    gfx.alpha = 0

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)

    const nodeRenderDatum: NodeRenderData = {
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
    }

    nodeRenderData.push(nodeRenderDatum)
  }

  for (const l of graphData.links) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)

    const linkRenderDatum: LinkRenderData = {
      simulationData: l,
      gfx,
      color: computedStyleMap["--lightgray"],
      alpha: 1,
      active: false,
    }

    linkRenderData.push(linkRenderDatum)
  }

  let currentTransform = zoomIdentity
  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => graphData.nodes.find((n) => n.id === hoveredNodeId))
        .on("start", function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(1).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
          dragging = false

          // if the time between mousedown and mouseup is short, we consider it a click
          if (Date.now() - dragStartTime < 500) {
            const node = graphData.nodes.find((n) => n.id === event.subject.id) as NodeData
            navigateToNode(node)
          }
        }),
    )
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("click", () => {
        navigateToNode(node.simulationData)
      })
    }
  }

  // PATCH (normcontrol-kb): поведение зума вынесено в переменную — её использует плавный зум к узлу
  const zoomBehavior = zoom<HTMLCanvasElement, NodeData>()
    .extent([
      [0, 0],
      [width, height],
    ])
    .scaleExtent([0.25, 4])
    .on("zoom", ({ transform }) => {
      currentTransform = transform
      stage.scale.set(transform.k, transform.k)
      stage.position.set(transform.x, transform.y)

      // подписи показываем только при наведении — при зуме прячем остальные
      const activeNodes = nodeRenderData.filter((n) => n.active).flatMap((n) => n.label)
      for (const label of labelsContainer.children) {
        if (!activeNodes.includes(label)) {
          label.alpha = 0
        }
      }
    })

  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(zoomBehavior)
  }

  // PATCH (normcontrol-kb): плавный зум к узлу, затем переход на страницу (клик по графу)
  let navigating = false
  function navigateToNode(node: NodeData) {
    if (navigating) return
    const targ = resolveRelative(fullSlug, node.id)
    const url = new URL(targ, window.location.toString())
    if (!enableZoom || node.x === undefined || node.y === undefined) {
      window.spaNavigate(url)
      return
    }
    navigating = true
    const from = currentTransform
    const targetK = Math.min(currentTransform.k * 1.5, 4)
    const tx = width / 2 - node.x * targetK
    const ty = height / 2 - node.y * targetK
    const start = performance.now()
    const step = () => {
      const p = Math.min((performance.now() - start) / ZOOM_TO_NODE_MS, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const k = from.k + (targetK - from.k) * eased
      const x = from.x + (tx - from.x) * eased
      const y = from.y + (ty - from.y) * eased
      zoomBehavior.transform(
        select<HTMLCanvasElement, NodeData>(app.canvas),
        zoomIdentity.translate(x, y).scale(k),
      )
      if (p < 1 && !stopAnimation) requestAnimationFrame(step)
    }
    step()
    window.setTimeout(() => window.spaNavigate(url), ZOOM_TO_NODE_MS)
  }

  let stopAnimation = false
  // PATCH (normcontrol-kb): фазы анимаций графа
  let swayPhase = 0
  let hubPhase = 0
  let linkPulse = 0
  let pullFactor = 0
  let fadeFactor = 1
  let leaving = false

  function handlePreNav() {
    // #20: мягкое исчезновение узлов при уходе со страницы
    leaving = true
  }
  document.addEventListener("prenav", handlePreNav)
  window.addEventListener("beforeunload", handlePreNav)

  function animate(time: number) {
    if (stopAnimation) return
    swayPhase += SWAY_STEP
    hubPhase += 0.01
    linkPulse += 0.02
    fadeFactor = Math.max(0, Math.min(1, fadeFactor + (leaving ? -0.06 : 0.08)))
    pullFactor = Math.max(0, Math.min(1, pullFactor + (hoveredNodeId && !dragging ? 0.18 : -0.18)))

    // «дыхание» включаем только когда симуляция остановилась, иначе она сама двигает узлы
    const simulationStopped = simulation.alpha() < 0.02
    const hoveredNode = hoveredNodeId ? nodesById.get(hoveredNodeId as SimpleSlug) : undefined
    const hoveredNeighbourIds = hoveredNode ? neighbourIds.get(hoveredNode.id) : undefined

    let nodeIndex = 0
    for (const n of nodeRenderData) {
      const data = n.simulationData
      if (data.x === undefined || data.y === undefined) {
        nodeIndex++
        continue
      }

      let px = data.x
      let py = data.y

      // #15 лёгкое покачивание после остановки симуляции
      if (simulationStopped) {
        px += Math.sin(swayPhase + nodeIndex * 0.3) * SWAY_AMPLITUDE
        py += Math.cos(swayPhase + nodeIndex * 0.3) * SWAY_AMPLITUDE
      }

      // #18 соседи слегка притягиваются к узлу под курсором
      if (hoveredNode && pullFactor > 0 && hoveredNeighbourIds?.has(data.id)) {
        const dx = (hoveredNode.x ?? 0) - data.x
        const dy = (hoveredNode.y ?? 0) - data.y
        const len = Math.hypot(dx, dy) || 1
        px += (dx / len) * PULL_DISTANCE * pullFactor
        py += (dy / len) * PULL_DISTANCE * pullFactor
      }

      n.gfx.position.set(px + width / 2, py + height / 2)
      if (n.label) {
        n.label.position.set(px + width / 2, py + height / 2)
      }

      // #11 появление «волной», #14 пульсация хабов, hover-увеличение, #20 исчезновение
      const delay = appearDelays.get(data.id) ?? 0
      const appearRaw = Math.max(0, Math.min(1, (time - appearStart - delay) / APPEAR_MS))
      const appear = 1 - Math.pow(1 - appearRaw, 3)
      const hubPulse = hubIds.has(data.id) ? 1 + Math.sin(hubPhase + nodeIndex * 0.5) * 0.15 : 1
      const hoverScale = data.id === hoveredNodeId && !dragging ? 1.3 : 1
      n.gfx.scale.set(Math.max(0.01, appear * hubPulse * hoverScale * fadeFactor))
      n.gfx.alpha = appearRaw * fadeFactor

      nodeIndex++
    }

    for (const l of linkRenderData) {
      const linkData = l.simulationData
      const x1 = linkData.source.x! + width / 2
      const y1 = linkData.source.y! + height / 2
      const x2 = linkData.target.x! + width / 2
      const y2 = linkData.target.y! + height / 2
      // связи рисуем лёгкой дугой — граф читается лучше
      const bow = 0.12
      const cx = (x1 + x2) / 2 - (y2 - y1) * bow
      const cy = (y1 + y2) / 2 + (x2 - x1) * bow
      // #13 пульсация связей в покое, #19 розовая «волна» от узла под курсором
      let alpha = hoveredNodeId ? l.alpha : l.alpha * (0.85 + Math.sin(linkPulse) * 0.25)
      let linkColor = l.color
      if (hoveredNodeId && l.active) {
        linkColor = "#b86a8a"
        alpha = 0.55 + Math.sin(linkPulse * 2) * 0.25
      }
      l.gfx.clear()
      l.gfx.moveTo(x1, y1)
      l.gfx.quadraticCurveTo(cx, cy, x2, y2)
      l.gfx.stroke({
        alpha: Math.max(0, Math.min(1, alpha)) * fadeFactor,
        width: 1,
        color: linkColor,
      })
    }

    tweens.forEach((t) => t.update(time))
    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
  return () => {
    stopAnimation = true
    document.removeEventListener("prenav", handlePreNav)
    window.removeEventListener("beforeunload", handlePreNav)
    app.destroy()
  }
}

let localGraphCleanups: (() => void)[] = []
let globalGraphCleanups: (() => void)[] = []

function cleanupLocalGraphs() {
  for (const cleanup of localGraphCleanups) {
    cleanup()
  }
  localGraphCleanups = []
}

function cleanupGlobalGraphs() {
  for (const cleanup of globalGraphCleanups) {
    cleanup()
  }
  globalGraphCleanups = []
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))

  async function renderLocalGraph() {
    cleanupLocalGraphs()
    const localGraphContainers = document.getElementsByClassName("graph-container")
    for (const container of localGraphContainers) {
      localGraphCleanups.push(await renderGraph(container as HTMLElement, slug))
    }
  }

  await renderLocalGraph()
  const handleThemeChange = () => {
    void renderLocalGraph()
  }

  document.addEventListener("themechange", handleThemeChange)
  window.addCleanup(() => {
    document.removeEventListener("themechange", handleThemeChange)
  })

  const containers = [...document.getElementsByClassName("global-graph-outer")] as HTMLElement[]
  async function renderGlobalGraph() {
    const slug = getFullSlug(window)
    for (const container of containers) {
      container.classList.add("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) {
        sidebar.style.zIndex = "1"
      }

      const graphContainer = container.querySelector(".global-graph-container") as HTMLElement
      registerEscapeHandler(container, hideGlobalGraph)
      if (graphContainer) {
        globalGraphCleanups.push(await renderGraph(graphContainer, slug))
      }
    }
  }

  function hideGlobalGraph() {
    cleanupGlobalGraphs()
    for (const container of containers) {
      container.classList.remove("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) {
        sidebar.style.zIndex = ""
      }
    }
  }

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const anyGlobalGraphOpen = containers.some((container) =>
        container.classList.contains("active"),
      )
      anyGlobalGraphOpen ? hideGlobalGraph() : renderGlobalGraph()
    }
  }

  const containerIcons = document.getElementsByClassName("global-graph-icon")
  Array.from(containerIcons).forEach((icon) => {
    icon.addEventListener("click", renderGlobalGraph)
    window.addCleanup(() => icon.removeEventListener("click", renderGlobalGraph))
  })

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => {
    document.removeEventListener("keydown", shortcutHandler)
    cleanupLocalGraphs()
    cleanupGlobalGraphs()
  })
})
