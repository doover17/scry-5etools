// [PERSONAL] DH 2026-03-24 — War Table: Spell Loadout Planner module

/**
 * WarTablePlanner — Spell Loadout Planner module for the War Table.
 *
 * Manages character profile, spell list browsing, prepared spell list,
 * and connects to the shared WarTableState for persistence.
 */
globalThis.WarTablePlanner = class {
	// -- Class list for dropdown (spellcasting classes only) ------------------
	static SPELLCASTING_CLASSES = [
		"Artificer",
		"Bard",
		"Cleric",
		"Druid",
		"Fighter",
		"Monk",
		"Paladin",
		"Ranger",
		"Rogue",
		"Sorcerer",
		"Warlock",
		"Wizard",
	];

	constructor ({state}) {
		this._state = state;
		this._allSpells = [];
		this._filteredSpells = [];
		this._searchTerm = "";

		// DOM references (set during render)
		this._$wrpProfile = null;
		this._$wrpSpellList = null;
		this._$wrpPrepared = null;
	}

	// -- Data loading --------------------------------------------------------
	async pInit () {
		try {
			this._allSpells = await DataUtil.spell.pLoadAll();
		} catch (e) {
			console.error("WarTablePlanner: Failed to load spells", e);
			this._allSpells = [];
		}
		this._filterSpellsByClass();
	}

	// -- Spell filtering -----------------------------------------------------
	_filterSpellsByClass () {
		const character = this._state.getCharacter();
		const className = character.className;

		this._filteredSpells = this._allSpells.filter(sp => {
			// Check classes.fromClassList for matching class name
			const classList = sp.classes?.fromClassList;
			if (!classList) return false;
			return classList.some(c => c.name === className);
		});

		// Sort by level then name
		this._filteredSpells.sort((a, b) => {
			if (a.level !== b.level) return a.level - b.level;
			return a.name.localeCompare(b.name);
		});
	}

	_getSearchFilteredSpells () {
		if (!this._searchTerm) return this._filteredSpells;
		const term = this._searchTerm.toLowerCase();
		return this._filteredSpells.filter(sp => sp.name.toLowerCase().includes(term));
	}

	// -- Rendering -----------------------------------------------------------
	renderTo ($parent) {
		const $wrp = document.createElement("div");
		$wrp.className = "wt-planner";

		// Character profile section
		this._$wrpProfile = this._renderProfileSection();
		$wrp.appendChild(this._$wrpProfile);

		// Spell list section
		this._$wrpSpellList = this._renderSpellListSection();
		$wrp.appendChild(this._$wrpSpellList);

		// Prepared spells section
		this._$wrpPrepared = this._renderPreparedSection();
		$wrp.appendChild(this._$wrpPrepared);

		$parent.appendChild($wrp);

		// Listen for state changes
		this._state.on("characterChange", () => {
			this._filterSpellsByClass();
			this._updateSpellListDisplay();
			this._updatePreparedDisplay();
			this._updateProfileDisplay();
		});

		this._state.on("preparedSpellsChange", () => {
			this._updateSpellListDisplay();
			this._updatePreparedDisplay();
		});

		this._state.on("stateChange", () => {
			this._filterSpellsByClass();
			this._updateAll();
		});
	}

	_updateAll () {
		this._updateProfileDisplay();
		this._updateSpellListDisplay();
		this._updatePreparedDisplay();
	}

	// -- Character Profile ---------------------------------------------------
	_renderProfileSection () {
		const section = this._makeSection("Character Profile", true);
		const content = section.querySelector(".wt-section__content");

		const character = this._state.getCharacter();

		content.innerHTML = `
			<div class="wt-profile">
				<div class="wt-profile__field">
					<label class="wt-profile__label">Class</label>
					<select class="wt-profile__select" data-field="className">
						${WarTablePlanner.SPELLCASTING_CLASSES.map(c =>
							`<option value="${c}" ${c === character.className ? "selected" : ""}>${c}</option>`,
						).join("")}
					</select>
				</div>
				<div class="wt-profile__field">
					<label class="wt-profile__label">Subclass</label>
					<input class="wt-profile__input" type="text" data-field="subclass"
						value="${this._escHtml(character.subclass)}" placeholder="e.g. Chronurgy">
				</div>
				<div class="wt-profile__field">
					<label class="wt-profile__label">Level</label>
					<input class="wt-profile__input" type="number" data-field="level"
						min="1" max="20" value="${character.level}">
				</div>
				<div class="wt-profile__field">
					<label class="wt-profile__label">Casting Mod</label>
					<input class="wt-profile__input" type="number" data-field="spellcastingModifier"
						min="-5" max="10" value="${character.spellcastingModifier}">
				</div>
				<div class="wt-profile__field">
					<label class="wt-profile__label">Save DC</label>
					<input class="wt-profile__input" type="number" data-field="saveDC"
						min="1" max="30" value="${character.saveDC}">
				</div>
				<div class="wt-profile__field">
					<label class="wt-profile__label">Spell Attack</label>
					<input class="wt-profile__input" type="number" data-field="spellAttackBonus"
						min="-5" max="20" value="${character.spellAttackBonus}">
				</div>
				<div class="wt-profile__field wt-profile__field--full">
					<div class="wt-features" data-features>
						<label class="wt-features__item">
							<input type="checkbox" data-feature="warCaster"
								${character.features.warCaster ? "checked" : ""}>
							War Caster
						</label>
						<label class="wt-features__item">
							<input type="checkbox" data-feature="resilientCon"
								${character.features.resilientCon ? "checked" : ""}>
							Resilient (Con)
						</label>
						<label class="wt-features__item">
							<input type="checkbox" data-feature="arcaneAbeyance"
								${character.features.arcaneAbeyance ? "checked" : ""}>
							Arcane Abeyance
						</label>
						<label class="wt-features__item">
							<input type="checkbox" data-feature="clockworkSpell"
								${character.features.clockworkSpell ? "checked" : ""}>
							Clockwork Spell
						</label>
					</div>
				</div>
			</div>
		`;

		// Bind profile field events
		content.querySelectorAll("[data-field]").forEach(el => {
			const field = el.dataset.field;
			el.addEventListener("change", () => {
				let val = el.value;
				if (el.type === "number") val = parseInt(val, 10) || 0;
				this._state.setCharacter({[field]: val});
			});
		});

		// Bind feature checkbox events
		content.querySelectorAll("[data-feature]").forEach(el => {
			const feature = el.dataset.feature;
			el.addEventListener("change", () => {
				this._state.setCharacterFeatures({[feature]: el.checked});
			});
		});

		return section;
	}

	_updateProfileDisplay () {
		// Update slot info display if present
		const slotInfo = this._$wrpProfile?.querySelector("[data-slot-info]");
		if (slotInfo) {
			const slots = this._state.getSpellSlots();
			slotInfo.textContent = `Slots: ${slots.max.filter(s => s > 0).map((s, i) => `L${i + 1}:${s}`).join(" ")}`;
		}
	}

	// -- Spell List ----------------------------------------------------------
	_renderSpellListSection () {
		const section = this._makeSection("Spell List", true);
		const content = section.querySelector(".wt-section__content");

		const searchInput = document.createElement("input");
		searchInput.className = "wt-spell-list__search";
		searchInput.type = "text";
		searchInput.placeholder = "Search spells...";
		searchInput.addEventListener("input", () => {
			this._searchTerm = searchInput.value;
			this._updateSpellListDisplay();
		});
		content.appendChild(searchInput);

		const listContainer = document.createElement("div");
		listContainer.className = "wt-spell-list__items";
		listContainer.dataset.spellItems = "";
		content.appendChild(listContainer);

		this._updateSpellListDisplay(listContainer);

		return section;
	}

	_updateSpellListDisplay (container) {
		const listContainer = container || this._$wrpSpellList?.querySelector("[data-spell-items]");
		if (!listContainer) return;

		const spells = this._getSearchFilteredSpells();
		const prepared = this._state.getPreparedSpells();
		const preparedKeys = new Set(prepared.map(s => `${s.name}|${s.source}`));

		// Virtual scroll: only render visible spells (max 100 at a time for performance)
		const renderSpells = spells.slice(0, 200);

		listContainer.innerHTML = renderSpells.map(sp => {
			const key = `${sp.name}|${sp.source}`;
			const isPrepared = preparedKeys.has(key);
			const levelText = sp.level === 0 ? "C" : sp.level;
			const levelClass = sp.level === 0 ? "wt-spell-list__level-badge--cantrip" : "";

			return `<div class="wt-spell-list__item ${isPrepared ? "wt-spell-list__item--prepared" : ""}"
						data-spell-name="${this._escAttr(sp.name)}"
						data-spell-source="${this._escAttr(sp.source)}"
						data-spell-level="${sp.level}"
						title="${this._escAttr(sp.name)} (${sp.source})${isPrepared ? " [Prepared]" : ""}">
				<span>
					<span class="wt-spell-list__level-badge ${levelClass}">${levelText}</span>
					${this._escHtml(sp.name)}
				</span>
				<span class="wt-text-muted" style="font-size:10px">${this._escHtml(sp.source)}</span>
			</div>`;
		}).join("");

		if (renderSpells.length === 0) {
			listContainer.innerHTML = `<div class="wt-prepared__empty">No spells found for this class.</div>`;
		}

		if (spells.length > 200) {
			listContainer.innerHTML += `<div class="wt-prepared__empty">Showing first 200 of ${spells.length} spells. Use search to narrow.</div>`;
		}

		// Bind click events
		listContainer.querySelectorAll(".wt-spell-list__item").forEach(el => {
			el.addEventListener("click", () => {
				const name = el.dataset.spellName;
				const source = el.dataset.spellSource;
				const level = parseInt(el.dataset.spellLevel, 10);
				const prepKey = `${name}|${source}`;

				if (preparedKeys.has(prepKey)) {
					this._state.removePreparedSpell(name, source);
				} else {
					this._state.addPreparedSpell({name, source, level});
				}
			});
		});
	}

	// -- Prepared Spells -----------------------------------------------------
	_renderPreparedSection () {
		const section = this._makeSection("Prepared Spells", true);
		const content = section.querySelector(".wt-section__content");

		const header = document.createElement("div");
		header.className = "wt-prepared__header";
		header.innerHTML = `
			<span data-prepared-title>Prepared Spells</span>
			<span class="wt-prepared__header-count" data-prepared-count></span>
		`;
		content.appendChild(header);

		const list = document.createElement("div");
		list.className = "wt-prepared__list";
		list.dataset.preparedList = "";
		content.appendChild(list);

		this._updatePreparedDisplay(content);

		return section;
	}

	_updatePreparedDisplay (container) {
		const root = container || this._$wrpPrepared?.querySelector(".wt-section__content");
		if (!root) return;

		const prepared = this._state.getPreparedSpells();
		const maxPrep = this._state.getMaxPreparedSpells();
		const countEl = root.querySelector("[data-prepared-count]");
		const listEl = root.querySelector("[data-prepared-list]");

		if (countEl) {
			if (maxPrep !== null) {
				const isOver = prepared.length > maxPrep;
				countEl.textContent = `${prepared.length} / ${maxPrep}`;
				countEl.className = `wt-prepared__header-count ${isOver ? "wt-text-danger" : ""}`;
			} else {
				countEl.textContent = `${prepared.length} (spells known)`;
				countEl.className = "wt-prepared__header-count";
			}
		}

		if (listEl) {
			if (prepared.length === 0) {
				listEl.innerHTML = `<div class="wt-prepared__empty">Click spells from the list above to prepare them.</div>`;
			} else {
				// Sort by level then name
				const sorted = [...prepared].sort((a, b) => {
					if (a.level !== b.level) return (a.level || 0) - (b.level || 0);
					return a.name.localeCompare(b.name);
				});

				listEl.innerHTML = sorted.map(sp => {
					const levelText = sp.level === 0 ? "C" : sp.level;
					const levelClass = sp.level === 0 ? "wt-spell-list__level-badge--cantrip" : "";

					return `<div class="wt-prepared__item"
								data-prep-name="${this._escAttr(sp.name)}"
								data-prep-source="${this._escAttr(sp.source)}">
						<span>
							<span class="wt-spell-list__level-badge ${levelClass}">${levelText}</span>
							${this._escHtml(sp.name)}
						</span>
						<button class="wt-prepared__item-remove" data-remove
							title="Remove from prepared">&times;</button>
					</div>`;
				}).join("");

				// Bind remove buttons
				listEl.querySelectorAll("[data-remove]").forEach(btn => {
					btn.addEventListener("click", (e) => {
						e.stopPropagation();
						const row = btn.closest(".wt-prepared__item");
						this._state.removePreparedSpell(row.dataset.prepName, row.dataset.prepSource);
					});
				});
			}
		}
	}

	// -- Utility: collapsible section ----------------------------------------
	_makeSection (title, startOpen = false) {
		const section = document.createElement("div");
		section.className = `wt-section ${startOpen ? "wt-section--open" : ""}`;

		const header = document.createElement("div");
		header.className = "wt-section__header";
		header.innerHTML = `
			<span class="wt-section__title">${this._escHtml(title)}</span>
			<span class="wt-section__chevron">&#9660;</span>
		`;
		header.addEventListener("click", () => {
			section.classList.toggle("wt-section--open");
		});

		const content = document.createElement("div");
		content.className = "wt-section__content";

		section.appendChild(header);
		section.appendChild(content);
		return section;
	}

	// -- HTML escaping -------------------------------------------------------
	_escHtml (str) {
		const div = document.createElement("div");
		div.textContent = str ?? "";
		return div.innerHTML;
	}

	_escAttr (str) {
		return (str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
};
