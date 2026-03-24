// [PERSONAL] DH 2026-03-24 — Spell preparation and slot tracker
// Loads all spells via DataUtil.spell.pLoadAll(), persists state in localStorage.

const _ST_STORAGE_KEY = "SpellTracker.v1";

// Standard full-caster spell slots per class level (PHB p. 165).
// Index 0 = spell level 1, index 8 = spell level 9.
const _FULL_CASTER_SLOTS = {
	1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
	2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
	3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
	4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
	5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
	6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
	7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
	8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
	9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
	10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
	11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
	12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
	13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
	14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
	15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
	16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
	17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
	18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
	19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
	20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

class SpellTrackerPage {
	constructor () {
		this._allSpells = [];
		this._state = this._loadState();
		this._search = "";
		this._lvlFilter = null; // null = all levels
	}

	// ── State persistence ──────────────────────────────────────────────────────

	_defaultState () {
		return {
			prepared: {}, // hash → {name, source, level, cast}
			slots: Object.fromEntries(
				Array.from({length: 9}, (_, i) => [i + 1, {max: 0, used: 0}]),
			),
		};
	}

	_loadState () {
		try {
			const raw = localStorage.getItem(_ST_STORAGE_KEY);
			if (!raw) return this._defaultState();
			const parsed = JSON.parse(raw);
			const def = this._defaultState();
			return {prepared: parsed.prepared ?? def.prepared, slots: parsed.slots ?? def.slots};
		} catch { return this._defaultState(); }
	}

	_save () { localStorage.setItem(_ST_STORAGE_KEY, JSON.stringify(this._state)); }

	// ── Init ───────────────────────────────────────────────────────────────────

	async pInit () {
		const data = await DataUtil.spell.pLoadAll();
		this._allSpells = data.sort((a, b) =>
			SortUtil.ascSort(a.level, b.level) || SortUtil.ascSortLower(a.name, b.name),
		);
		this._renderAll();
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	_renderAll () {
		this._renderLeft();
		this._renderSlots();
		this._renderPrepared();
	}

	// Left panel: search controls + scrollable spell list

	_renderLeft () {
		const wrp = document.getElementById("st-left");
		wrp.innerHTML = "";

		// Search input
		const search = document.createElement("input");
		search.type = "search";
		search.className = "ve-form-control ve-w-100";
		search.placeholder = "Search spells…";
		search.value = this._search;
		search.addEventListener("input", e => {
			this._search = e.target.value.toLowerCase();
			this._updateSpellList(list);
		});

		// Level filter buttons: All | C | 1–9
		const filterRow = document.createElement("div");
		filterRow.className = "ve-btn-group ve-flex ve-flex-wrap ve-mt-1 ve-mb-1";
		this._buildLevelFilterBtns(filterRow, list => this._updateSpellList(list));

		// Scrollable list
		const list = document.createElement("div");
		list.className = "st-spell-list";

		wrp.append(search, filterRow, list);

		// Re-attach filter btn references now that list exists
		filterRow.innerHTML = "";
		this._buildLevelFilterBtns(filterRow, () => this._updateSpellList(list));

		this._updateSpellList(list);
	}

	_buildLevelFilterBtns (container, onChange) {
		["All", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(v => {
			const isAll = v === "All";
			const isActive = isAll ? this._lvlFilter === null : this._lvlFilter === v;
			const btn = document.createElement("button");
			btn.className = `ve-btn ve-btn-xs ${isActive ? "ve-btn-primary" : "ve-btn-default"}`;
			btn.textContent = isAll ? "All" : v === 0 ? "C" : `${v}`;
			btn.title = isAll ? "All levels" : v === 0 ? "Cantrips" : `Level ${v}`;
			btn.addEventListener("click", () => {
				this._lvlFilter = isAll ? null : v;
				container.innerHTML = "";
				this._buildLevelFilterBtns(container, onChange);
				onChange();
			});
			container.append(btn);
		});
	}

	_updateSpellList (listEl) {
		listEl.innerHTML = "";
		const filtered = this._allSpells.filter(sp => {
			if (this._lvlFilter !== null && sp.level !== this._lvlFilter) return false;
			if (this._search && !sp.name.toLowerCase().includes(this._search)) return false;
			return true;
		});

		if (!filtered.length) {
			listEl.innerHTML = `<div class="ve-flex-vh-center ve-p-2 ve-muted ve-small">No spells found</div>`;
			return;
		}

		const frag = document.createDocumentFragment();
		for (const sp of filtered) {
			const hash = UrlUtil.autoEncodeHash(sp);
			const isPrepared = !!this._state.prepared[hash];

			const row = document.createElement("div");
			row.className = `st-spell-row${isPrepared ? " st-spell-row--prepared" : ""}`;
			row.title = `${sp.name} (${Parser.sourceJsonToAbv(sp.source)}) — click to ${isPrepared ? "un-prepare" : "prepare"}`;

			const lvlSpan = document.createElement("span");
			lvlSpan.className = `st-spell-row__lvl ${Parser.spSchoolAbvToStyleClass(sp.school)}`;
			if (Parser.spSchoolAbvToStyle(sp.school)) lvlSpan.style.cssText = Parser.spSchoolAbvToStyle(sp.school);
			lvlSpan.textContent = sp.level === 0 ? "C" : `${sp.level}`;

			const nameSpan = document.createElement("span");
			nameSpan.className = "st-spell-row__name";
			nameSpan.textContent = sp.name;

			const srcSpan = document.createElement("span");
			srcSpan.className = "st-spell-row__src";
			srcSpan.textContent = Parser.sourceJsonToAbv(sp.source);

			row.append(lvlSpan, nameSpan, srcSpan);
			row.addEventListener("click", () => this._togglePrepared(sp, hash));
			frag.append(row);
		}
		listEl.append(frag);
	}

	_togglePrepared (sp, hash) {
		if (this._state.prepared[hash]) {
			delete this._state.prepared[hash];
		} else {
			this._state.prepared[hash] = {name: sp.name, source: sp.source, level: sp.level, cast: false};
		}
		this._save();
		// Refresh left list to update highlight, refresh right panel
		const list = document.querySelector(".st-spell-list");
		if (list) this._updateSpellList(list);
		this._renderPrepared();
	}

	// Right top: spell slot tracker

	_renderSlots () {
		const wrp = document.getElementById("st-slots");
		wrp.innerHTML = "";

		// Title row
		const titleRow = document.createElement("div");
		titleRow.className = "ve-flex-v-center ve-mb-2";
		titleRow.innerHTML = `<b class="ve-mr-auto">Spell Slots</b>`;

		// Full-caster preset selector
		const sel = document.createElement("select");
		sel.className = "ve-form-control ve-input-sm ve-w-auto ve-mr-1";
		sel.innerHTML = `<option value="">Full caster preset…</option>` +
			Array.from({length: 20}, (_, i) => `<option value="${i + 1}">Level ${i + 1}</option>`).join("");
		sel.addEventListener("change", () => {
			const lvl = parseInt(sel.value);
			if (!lvl) return;
			const tbl = _FULL_CASTER_SLOTS[lvl];
			for (let i = 1; i <= 9; i++) this._state.slots[i] = {max: tbl[i - 1], used: 0};
			this._save();
			this._renderSlots();
		});

		// Long rest button
		const btnRest = document.createElement("button");
		btnRest.className = "ve-btn ve-btn-xs ve-btn-default";
		btnRest.textContent = "Long Rest";
		btnRest.title = "Reset all used slots to 0";
		btnRest.addEventListener("click", () => {
			Object.values(this._state.slots).forEach(s => { s.used = 0; });
			this._save();
			this._renderSlots();
		});

		titleRow.append(sel, btnRest);
		wrp.append(titleRow);

		// One row per spell level 1–9
		for (let lvl = 1; lvl <= 9; lvl++) {
			const slot = this._state.slots[lvl];
			if (!slot) continue;
			wrp.append(this._buildSlotRow(lvl, slot));
		}
	}

	_buildSlotRow (lvl, slot) {
		const row = document.createElement("div");
		row.className = "st-slot-row";

		const label = document.createElement("span");
		label.className = "st-slot-row__label";
		label.textContent = `Slot ${lvl}`;

		// Max adjuster: − MAX +
		const adj = document.createElement("div");
		adj.className = "st-slot-row__adj";

		const btnDec = document.createElement("button");
		btnDec.className = "ve-btn ve-btn-xs ve-btn-default";
		btnDec.textContent = "−";
		btnDec.addEventListener("click", () => {
			slot.max = Math.max(0, slot.max - 1);
			slot.used = Math.min(slot.used, slot.max);
			this._save();
			this._renderSlots();
		});

		const maxLbl = document.createElement("span");
		maxLbl.style.cssText = "min-width:32px;text-align:center;font-size:12px;";
		maxLbl.textContent = `${slot.max}`;

		const btnInc = document.createElement("button");
		btnInc.className = "ve-btn ve-btn-xs ve-btn-default";
		btnInc.textContent = "+";
		btnInc.addEventListener("click", () => {
			slot.max = Math.min(slot.max + 1, 9);
			this._save();
			this._renderSlots();
		});

		adj.append(btnDec, maxLbl, btnInc);

		// Clickable pips: filled = available, empty circle = used
		const pips = document.createElement("div");
		pips.className = "st-slot-row__pips";

		if (slot.max === 0) {
			pips.innerHTML = `<span style="font-size:11px;opacity:0.4;">—</span>`;
		} else {
			for (let i = 0; i < slot.max; i++) {
				const used = i < slot.used;
				const pip = document.createElement("button");
				pip.className = `st-pip ${used ? "st-pip--used" : "st-pip--avail"}`;
				pip.title = used ? "Used — click to restore" : "Available — click to use";
				pip.addEventListener("click", () => {
					slot.used = used ? Math.max(0, slot.used - 1) : Math.min(slot.max, slot.used + 1);
					this._save();
					this._renderSlots();
				});
				pips.append(pip);
			}
		}

		row.append(label, adj, pips);
		return row;
	}

	// Right bottom: prepared spells list

	_renderPrepared () {
		const wrp = document.getElementById("st-prepared");
		wrp.innerHTML = "";

		const prepared = Object.entries(this._state.prepared)
			.map(([hash, sp]) => ({hash, ...sp}))
			.sort((a, b) => SortUtil.ascSort(a.level, b.level) || SortUtil.ascSortLower(a.name, b.name));

		// Title row
		const titleRow = document.createElement("div");
		titleRow.className = "ve-flex-v-center ve-mb-2";
		titleRow.innerHTML = `<b class="ve-mr-auto">Prepared Spells (${prepared.length})</b>`;

		const btnUncast = document.createElement("button");
		btnUncast.className = "ve-btn ve-btn-xs ve-btn-default ve-mr-1";
		btnUncast.textContent = "Uncast all";
		btnUncast.title = "Mark all spells as not cast";
		btnUncast.addEventListener("click", () => {
			Object.values(this._state.prepared).forEach(s => { s.cast = false; });
			this._save();
			this._renderPrepared();
		});

		const btnClear = document.createElement("button");
		btnClear.className = "ve-btn ve-btn-xs ve-btn-default";
		btnClear.textContent = "Clear all";
		btnClear.addEventListener("click", () => {
			if (!confirm("Remove all prepared spells?")) return;
			this._state.prepared = {};
			this._save();
			this._renderAll();
		});

		titleRow.append(btnUncast, btnClear);
		wrp.append(titleRow);

		if (!prepared.length) {
			wrp.innerHTML += `<div class="ve-muted ve-small ve-p-1">Click a spell in the left panel to prepare it.</div>`;
			return;
		}

		const list = document.createElement("div");
		list.className = "st-prepared-list";
		wrp.append(list);

		let currentLvl = -1;
		for (const sp of prepared) {
			if (sp.level !== currentLvl) {
				currentLvl = sp.level;
				const hdr = document.createElement("div");
				hdr.className = "st-prepared-level-header";
				hdr.textContent = sp.level === 0 ? "Cantrips" : `Level ${sp.level}`;
				list.append(hdr);
			}
			list.append(this._buildPreparedRow(sp));
		}
	}

	_buildPreparedRow (sp) {
		const row = document.createElement("div");
		row.className = `st-prepared-row${sp.cast ? " st-prepared-row--cast" : ""}`;

		// Cast toggle (cantrips don't consume slots)
		if (sp.level > 0) {
			const castBtn = document.createElement("button");
			castBtn.className = `ve-btn ve-btn-xs ve-mr-2 ${sp.cast ? "ve-btn-warning" : "ve-btn-default"}`;
			castBtn.textContent = sp.cast ? "↩" : "Cast";
			castBtn.title = sp.cast ? "Mark as available" : "Mark as cast";
			castBtn.addEventListener("click", () => {
				this._state.prepared[sp.hash].cast = !this._state.prepared[sp.hash].cast;
				this._save();
				this._renderPrepared();
			});
			row.append(castBtn);
		}

		const name = document.createElement("span");
		name.className = `st-prepared-row__name${sp.cast ? " st-prepared-row__name--cast" : ""}`;
		name.textContent = sp.name;

		const src = document.createElement("span");
		src.className = "st-prepared-row__src";
		src.textContent = Parser.sourceJsonToAbv(sp.source);

		const removeBtn = document.createElement("button");
		removeBtn.className = "ve-btn ve-btn-xs ve-btn-default ve-ml-1";
		removeBtn.textContent = "×";
		removeBtn.title = "Remove from prepared list";
		removeBtn.addEventListener("click", () => {
			delete this._state.prepared[sp.hash];
			this._save();
			this._renderAll();
		});

		row.append(name, src, removeBtn);
		return row;
	}
}

window.addEventListener("load", () => new SpellTrackerPage().pInit());
