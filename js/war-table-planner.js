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

		// Slot resource bar section
		this._$wrpSlots = this._renderSlotSection();
		$wrp.appendChild(this._$wrpSlots);

		// Analysis feedback section
		this._$wrpAnalysis = this._renderAnalysisSection();
		$wrp.appendChild(this._$wrpAnalysis);

		$parent.appendChild($wrp);

		// Listen for state changes
		this._state.on("characterChange", () => {
			this._filterSpellsByClass();
			this._updateSpellListDisplay();
			this._updatePreparedDisplay();
			this._updateProfileDisplay();
			this._updateAnalysisDisplay();
		});

		this._state.on("preparedSpellsChange", () => {
			this._updateSpellListDisplay();
			this._updatePreparedDisplay();
			this._updateAnalysisDisplay();
		});

		this._state.on("slotsChange", () => {
			this._updateSlotDisplay();
			this._updateAnalysisDisplay();
		});

		this._state.on("abeyanceChange", () => {
			this._updateSlotDisplay();
		});

		this._state.on("modeChange", () => {
			this._updateSlotDisplay();
			this._updateAnalysisDisplay();
		});

		this._state.on("forecastChange", () => {
			this._updateAnalysisDisplay();
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
		this._updateSlotDisplay();
		this._updateAnalysisDisplay();
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

	// -- Slot Resource Bar ----------------------------------------------------
	_renderSlotSection () {
		const section = this._makeSection("Spell Slots", true);
		const content = section.querySelector(".wt-section__content");

		const slotsWrp = document.createElement("div");
		slotsWrp.className = "wt-slots";
		slotsWrp.dataset.slotsContainer = "";
		content.appendChild(slotsWrp);

		// Arcane Abeyance bead indicator
		const abeyanceWrp = document.createElement("div");
		abeyanceWrp.className = "wt-slots__abeyance";
		abeyanceWrp.dataset.abeyanceContainer = "";
		abeyanceWrp.style.display = "none";
		content.appendChild(abeyanceWrp);

		// Restore all button
		const restoreBtn = document.createElement("button");
		restoreBtn.className = "wt-btn wt-btn--small";
		restoreBtn.textContent = "Long Rest (Restore All)";
		restoreBtn.style.marginTop = "8px";
		restoreBtn.addEventListener("click", () => {
			this._state.restoreAllSlots();
		});
		content.appendChild(restoreBtn);

		this._updateSlotDisplay(content);

		return section;
	}

	_updateSlotDisplay (container) {
		const root = container || this._$wrpSlots?.querySelector(".wt-section__content");
		if (!root) return;

		const slots = this._state.getSpellSlots();
		const mode = this._state.getMode();
		const isLive = mode === "live";
		const abeyance = this._state.getArcaneAbeyance();
		const features = this._state.getCharacter().features;

		const slotsContainer = root.querySelector("[data-slots-container]");
		if (slotsContainer) {
			slotsContainer.className = `wt-slots ${isLive ? "wt-slots--live" : ""}`;

			const rows = [];
			for (let lvl = 0; lvl < 9; lvl++) {
				const max = slots.max[lvl];
				if (max === 0) continue;

				const current = slots.current[lvl];
				const pips = [];

				for (let p = 0; p < max; p++) {
					const isFilled = p < current;
					const pipClass = isFilled ? "wt-slots__pip--filled" : "wt-slots__pip--expended";
					pips.push(
						`<div class="wt-slots__pip ${pipClass}"
							data-slot-level="${lvl}"
							data-slot-pip="${p}"
							title="Level ${lvl + 1} slot ${p + 1}/${max}${isLive ? " (click: expend, right-click: restore)" : ""}">
						</div>`,
					);
				}

				rows.push(`
					<div class="wt-slots__row">
						<span class="wt-slots__label">${lvl + 1}</span>
						<div class="wt-slots__pips">${pips.join("")}</div>
						<span class="wt-text-muted" style="font-size:10px">${current}/${max}</span>
					</div>
				`);
			}

			if (rows.length === 0) {
				slotsContainer.innerHTML = `<div class="wt-prepared__empty">No spell slots at this level.</div>`;
			} else {
				slotsContainer.innerHTML = rows.join("");
			}

			// Bind pip click events in live mode
			if (isLive) {
				slotsContainer.querySelectorAll(".wt-slots__pip").forEach(pip => {
					const lvl = parseInt(pip.dataset.slotLevel, 10);

					// Left click: expend
					pip.addEventListener("click", (e) => {
						e.preventDefault();
						this._state.expendSlot(lvl);
					});

					// Right click: restore
					pip.addEventListener("contextmenu", (e) => {
						e.preventDefault();
						this._state.restoreSlot(lvl);
					});
				});
			}
		}

		// Arcane Abeyance bead
		const abeyanceContainer = root.querySelector("[data-abeyance-container]");
		if (abeyanceContainer) {
			if (features.arcaneAbeyance) {
				abeyanceContainer.style.display = "";
				const storedSpell = abeyance.storedSpell;

				if (storedSpell) {
					abeyanceContainer.innerHTML = `
						<span class="wt-slots__abeyance-label">Abeyance Bead:</span>
						<span>${this._escHtml(storedSpell.name)} (L${storedSpell.level})</span>
						<button class="wt-btn wt-btn--small" data-clear-abeyance title="Release stored spell">Release</button>
					`;
					abeyanceContainer.querySelector("[data-clear-abeyance]")?.addEventListener("click", () => {
						this._state.setArcaneAbeyance(null);
					});
				} else {
					abeyanceContainer.innerHTML = `
						<span class="wt-slots__abeyance-label">Abeyance Bead:</span>
						<span class="wt-text-muted">Empty &mdash; store a level 1-4 spell</span>
					`;
				}
			} else {
				abeyanceContainer.style.display = "none";
			}
		}
	}

	// -- Analysis Feedback ----------------------------------------------------
	_renderAnalysisSection () {
		const section = this._makeSection("Loadout Analysis", true);
		const content = section.querySelector(".wt-section__content");

		const analysisWrp = document.createElement("div");
		analysisWrp.className = "wt-analysis";
		analysisWrp.dataset.analysisContainer = "";
		content.appendChild(analysisWrp);

		this._updateAnalysisDisplay(content);

		return section;
	}

	_updateAnalysisDisplay (container) {
		const root = container || this._$wrpAnalysis?.querySelector(".wt-section__content");
		if (!root) return;

		const el = root.querySelector("[data-analysis-container]");
		if (!el) return;

		const insights = this._computeAnalysis();
		if (insights.length === 0) {
			el.innerHTML = `<div class="wt-prepared__empty">Prepare some spells to see analysis.</div>`;
			return;
		}

		el.innerHTML = insights.map(insight => {
			const iconMap = {info: "&#9432;", warn: "&#9888;", good: "&#10003;", tip: "&#9733;"};
			return `<div class="wt-analysis__item wt-analysis__item--${insight.type}">
				<span class="wt-analysis__icon">${iconMap[insight.type] || ""}</span>
				<span>${insight.text}</span>
			</div>`;
		}).join("");
	}

	_computeAnalysis () {
		const insights = [];
		const character = this._state.getCharacter();
		const prepared = this._state.getPreparedSpells();
		const slots = this._state.getSpellSlots();
		const maxPrep = this._state.getMaxPreparedSpells();
		const forecast = this._state.getForecast();
		const mode = this._state.getMode();

		if (prepared.length === 0) return insights;

		// -- Prepared count warnings --
		if (maxPrep !== null) {
			if (prepared.length > maxPrep) {
				insights.push({type: "warn", text: `Over-prepared: ${prepared.length}/${maxPrep} spells. Remove ${prepared.length - maxPrep} spell(s).`});
			} else if (prepared.length < maxPrep) {
				insights.push({type: "tip", text: `${maxPrep - prepared.length} preparation slot(s) unused. Consider filling them.`});
			} else {
				insights.push({type: "good", text: `Preparation slots fully used (${maxPrep}/${maxPrep}).`});
			}
		}

		// -- Concentration count --
		const concSpells = prepared.filter(sp => this._isConcentration(sp));
		if (concSpells.length === 0 && prepared.some(sp => sp.level > 0)) {
			insights.push({type: "warn", text: "No concentration spells prepared. Consider adding one for sustained value."});
		} else if (concSpells.length > 0) {
			const ratio = concSpells.length / Math.max(1, prepared.filter(sp => sp.level > 0).length);
			if (ratio > 0.6) {
				insights.push({type: "warn", text: `${concSpells.length} of ${prepared.filter(sp => sp.level > 0).length} leveled spells require concentration. You can only maintain one at a time.`});
			} else {
				insights.push({type: "info", text: `${concSpells.length} concentration spell(s) prepared.`});
			}
		}

		// -- Spell level coverage --
		const levelCounts = {};
		for (const sp of prepared) {
			levelCounts[sp.level] = (levelCounts[sp.level] || 0) + 1;
		}

		// Check for unused slot levels
		const unusedLevels = [];
		for (let i = 0; i < 9; i++) {
			if (slots.max[i] > 0 && !levelCounts[i + 1]) {
				unusedLevels.push(i + 1);
			}
		}
		if (unusedLevels.length > 0) {
			insights.push({type: "tip", text: `No spells prepared at level ${unusedLevels.join(", ")}. You have slots available at ${unusedLevels.length === 1 ? "this level" : "these levels"}.`});
		}

		// -- Cantrip check --
		const cantripCount = levelCounts[0] || 0;
		if (cantripCount === 0) {
			insights.push({type: "tip", text: "No cantrips prepared. Cantrips are your free at-will damage/utility."});
		}

		// -- Slot budget analysis (planning mode) --
		if (mode === "planning") {
			const totalSlots = slots.max.reduce((s, v) => s + v, 0);
			const leveledPrepared = prepared.filter(sp => sp.level > 0).length;

			if (totalSlots > 0 && leveledPrepared > 0) {
				const budgetNotes = this._getSlotBudgetNotes(totalSlots, forecast);
				if (budgetNotes) insights.push(budgetNotes);
			}
		}

		// -- Live mode: remaining slot analysis --
		if (mode === "live") {
			const totalRemaining = slots.current.reduce((s, v) => s + v, 0);
			const totalMax = slots.max.reduce((s, v) => s + v, 0);
			const pctUsed = totalMax > 0 ? ((totalMax - totalRemaining) / totalMax) : 0;

			if (totalRemaining === 0) {
				insights.push({type: "warn", text: "All spell slots expended. Rely on cantrips until rest."});
			} else if (pctUsed > 0.75) {
				insights.push({type: "warn", text: `${totalRemaining}/${totalMax} slots remaining (${Math.round(pctUsed * 100)}% used). Conserve resources.`});
			} else if (pctUsed > 0.5) {
				insights.push({type: "info", text: `${totalRemaining}/${totalMax} slots remaining. Pace yourself.`});
			}
		}

		// -- Ritual spells hint --
		const rituals = prepared.filter(sp => this._isRitual(sp));
		if (rituals.length > 0 && character.className === "Wizard") {
			insights.push({type: "info", text: `${rituals.length} ritual(s) prepared. Wizards can cast rituals without expending slots.`});
		}

		return insights;
	}

	_getSlotBudgetNotes (totalSlots, forecast) {
		// Estimate session slot budget by intensity + rest availability
		let budgetMultiplier = 1;
		let intensityLabel = "moderate";

		switch (forecast.combatIntensity) {
			case "light": budgetMultiplier = 0.5; intensityLabel = "light"; break;
			case "moderate": budgetMultiplier = 1; intensityLabel = "moderate"; break;
			case "heavy": budgetMultiplier = 1.5; intensityLabel = "heavy"; break;
		}

		let restNote = "";
		switch (forecast.restAvailability) {
			case "longRest": restNote = "Full recovery expected."; break;
			case "shortRests": restNote = "Short rests available (Warlocks benefit)."; break;
			case "noRests": restNote = "No rests — budget every slot carefully."; budgetMultiplier *= 1.3; break;
		}

		const estimatedNeed = Math.ceil(totalSlots * budgetMultiplier);
		if (estimatedNeed > totalSlots) {
			return {type: "warn", text: `${intensityLabel.charAt(0).toUpperCase() + intensityLabel.slice(1)} session with ${forecast.restAvailability === "noRests" ? "no rests" : "limited rests"}: you may run short on slots. ${restNote}`};
		}
		return {type: "info", text: `Session forecast: ${intensityLabel} intensity. ${restNote}`};
	}

	// -- Spell property lookups (from loaded spell data) ---------------------
	_isConcentration (preparedSpell) {
		const sp = this._findSpellData(preparedSpell);
		return sp?.duration?.some(d => d.concentration === true) ?? false;
	}

	_isRitual (preparedSpell) {
		const sp = this._findSpellData(preparedSpell);
		return sp?.meta?.ritual === true;
	}

	_findSpellData (preparedSpell) {
		return this._allSpells.find(
			sp => sp.name === preparedSpell.name && sp.source === preparedSpell.source,
		);
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
