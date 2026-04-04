# Changelog - Quantum Flow Lib
## 2026-03-01

### ✨ Nouveautés / Améliorations

**Initialisation du package**
- Initialiser le package @quantum-studios/flow

**Core & Types TypeScript**
- Ajouter types TypeScript core (FlowNode, FlowPin, FlowConnection)
- Ajouter GraphModel avec nodes, connections, et sérialisation
- Ajouter API defineNode et NodeRegistry
- Ajouter ConnectionValidator avec compatibilité des pins typée
- Ajouter undo/redo History

**Model v2 - Architecture event-driven**
- Ajouter EventBus type-safe (on/off/emit/once)
- Ajouter Validator composable avec 6 règles built-in
- Ajouter GraphStore avec events, validation, batch queries
- Ajouter HistoryManager avec auto-subscribe, transactions en batch, et labels
- Améliorer defineNode (UUID, validation des pins, catégorie)
- Améliorer NodeRegistry (unregister, has, getCategories)
- Remplacer GraphModel/ConnectionValidator/History par la nouvelle architecture v2

**Composants React & Storybook**
- Ajouter composant React FlowCanvas avec renderer canvas basique
- Ajouter Storybook avec stories FlowCanvas et defineNode

**Renderers**
- Ajouter renderer premium canvas avec pins, connexions Bézier, glow effects
- Ajouter renderer Obsidian Engine avec particules animées et nodes multi-couches
- Ajouter renderer professional clean inspiré par Claude Terminal
- Ajouter renderer style UE5 Blueprint
- Ajouter renderer style Claude Terminal
- Porter le style de rendu Claude Terminal WorkflowGraphEngine
- Ajouter workflow stories réels

**Couche d'interaction**
- Réécrire FlowCanvas avec boucle interactive rAF, viewport, sélection, et connexions
- Ajouter hook useCanvasInteraction composant tous les hooks d'interaction
- Ajouter hook useConnection avec aperçu draft et démarrage bidirectionnel
- Ajouter hook useHotkeys (Delete, Backspace, Ctrl+A)
- Ajouter hook useNodeDrag avec multi-sélection et snap-to-grid
- Ajouter hook useSelection avec toggle, rubber-band, et selectAll
- Ajouter utilitaire hitTest pour requêtes spatiales des nodes et pins

**Hooks API React**
- Ajouter hook useGraphStore pour création stable du store
- Ajouter hook useHistory avec reactive canUndo/canRedo
- Ajouter hook useFlowEditor composant store, history, et registry
- Ajouter export barrel React et connecter au main index

### 🐛 Corrections

- Corriger les problèmes de code review dans les hooks API React
- Résoudre les bugs de closure stale et améliorations de code review
- Aligner react-dom à v18 pour correspondre à la dépendance peer react

### 🔧 Technique

- Ajouter design API React (useFlowEditor, useGraphStore, useHistory)
- Ajouter plan d'implémentation React API (4 tâches, TDD)
- Ajouter design couche d'interaction (hooks, hit-testing, viewport)
- Ajouter plan d'implémentation couche d'interaction (8 tâches, TDD)
- Ajouter design architecture Model v2 event-driven
- Ajouter plan d'implémentation Model v2 (6 tâches, TDD)
- Ajouter spec design renderer UE-style
- Ajouter plan d'implémentation renderer UE-style