// [PERSONAL] DH 2026-03-24 — War Table: Encounter Forecast Panel module

/**
 * WarTableForecast — Encounter Forecast Panel for the War Table.
 *
 * Provides session forecast configuration, encounter builder,
 * slot expenditure estimation with attrition view, and
 * action economy snapshots per encounter.
 */
globalThis.WarTableForecast = class {
	// -- Forecast option labels ------------------------------------------------
	static COMBAT_INTENSITY = {
		light: "Light",
		moderate: "Moderate",
		heavy: "Heavy",
	};

	static ENCOUNTER_SCALE = {
		single: "Single Encounter",
		multiple: "Multiple Encounters",
		unknown: "Unknown",
	};

	static ENVIRONMENT = {
		dungeon: "Dungeon",
		wilderness: "Wilderness",
		urban: "Urban",
		social: "Social",
		mixed: "Mixed",
	};

	static REST_AVAILABILITY = {
		longRest: "Long Rest Available",
		shortRests: "Short Rests Only",
		noRests: "No Rests",
	};

	// -- Slot expenditure rate multipliers by intensity + rest ------------------
	// Fraction of total slots expected to be spent per encounter.
	static EXPENDITURE_RATES = {
		light: {longRest: 0.15, shortRests: 0.20, noRests: 0.10},
		moderate: {longRest: 0.25, shortRests: 0.30, noRests: 0.20},
		heavy: {longRest: 0.40, shortRests: 0.45, noRests: 0.35},
	};

	// -- Slot expenditure band thresholds (% of total slots used) --------------
	static EXPENDITURE_BANDS = [
		{max: 0.25, label: "Low", className: "wt-slot-band--low"},
		{max: 0.50, label: "Moderate", className: "wt-slot-band--moderate"},
		{max: 0.75, label: "Heavy", className: "wt-slot-band--heavy"},
		{max: Infinity, label: "Extreme", className: "wt-slot-band--extreme"},
	];

	constructor ({state}) {
		this._state = state;

		// DOM references (set during render)
		this._$wrpForecast = null;
		this._$wrpEncounters = null;
		this._$wrpAttrition = null;
		this._$wrpActionEconomy = null;
	}

	// -- Rendering -----------------------------------------------------------
	renderTo ($parent) {
		const $wrp = document.createElement("div");
		$wrp.className = "wt-forecast-panel";

		// Session Forecast Inputs section
		this._$wrpForecast = this._renderForecastSection();
		$wrp.appendChild(this._$wrpForecast);

		// Encounter Builder section
		this._$wrpEncounters = this._renderEncounterSection();
		$wrp.appendChild(this._$wrpEncounters);

		// Slot Expenditure Estimate section
		this._$wrpAttrition = this._renderAttritionSection();
		$wrp.appendChild(this._$wrpAttrition);

		// Action Economy Snapshot section
		this._$wrpActionEconomy = this._renderActionEconomySection();
		$wrp.appendChild(this._$wrpActionEconomy);

		$parent.appendChild($wrp);

		// Listen for state changes
		this._state.on("forecastChange", () => {
			this._updateForecastDisplay();
			this._updateAttritionDisplay();
			this._updateActionEconomyDisplay();
		});

		this._state.on("encountersChange", () => {
			this._updateEncounterDisplay();
			this._updateAttritionDisplay();
			this._updateActionEconomyDisplay();
		});

		this._state.on("slotsChange", () => {
			this._updateAttritionDisplay();
		});

		this._state.on("characterChange", () => {
			this._updateAttritionDisplay();
			this._updateActionEconomyDisplay();
		});

		this._state.on("stateChange", () => {
			this._updateAll();
		});
	}

	_updateAll () {
		this._updateForecastDisplay();
		this._updateEncounterDisplay();
		this._updateAttritionDisplay();
		this._updateActionEconomyDisplay();
	}

	// =========================================================================
	// 1. Session Forecast Inputs
	// =========================================================================
	_renderForecastSection () {
		const section = this._makeSection("Session Forecast", true);
		const content = section.querySelector(".wt-section__content");

		const formWrp = document.createElement("div");
		formWrp.className = "wt-forecast";
		formWrp.dataset.forecastForm = "";
		content.appendChild(formWrp);

		this._buildForecastForm(formWrp);
		return section;
	}

	_buildForecastForm (container) {
		const forecast = this._state.getForecast();

		container.innerHTML = `
			<div class="wt-forecast__field">
				<label class="wt-forecast__label">Combat Intensity</label>
				<select class="wt-forecast__select" data-forecast="combatIntensity">
					${this._buildOptions(WarTableForecast.COMBAT_INTENSITY, forecast.combatIntensity)}
				</select>
			</div>
			<div class="wt-forecast__field">
				<label class="wt-forecast__label">Encounter Scale</label>
				<select class="wt-forecast__select" data-forecast="encounterScale">
					${this._buildOptions(WarTableForecast.ENCOUNTER_SCALE, forecast.encounterScale)}
				</select>
			</div>
			<div class="wt-forecast__field">
				<label class="wt-forecast__label">Environment</label>
				<select class="wt-forecast__select" data-forecast="environment">
					${this._buildOptions(WarTableForecast.ENVIRONMENT, forecast.environment)}
				</select>
			</div>
			<div class="wt-forecast__field">
				<label class="wt-forecast__label">Rest Availability</label>
				<select class="wt-forecast__select" data-forecast="restAvailability">
					${this._buildOptions(WarTableForecast.REST_AVAILABILITY, forecast.restAvailability)}
				</select>
			</div>
		`;

		this._bindForecastEvents(container);
	}

	_bindForecastEvents (container) {
		container.querySelectorAll("[data-forecast]").forEach(el => {
			el.addEventListener("change", () => {
				this._state.setForecast({[el.dataset.forecast]: el.value});
			});
		});
	}

	_updateForecastDisplay () {
		const container = this._$wrpForecast?.querySelector("[data-forecast-form]");
		if (!container) return;

		const forecast = this._state.getForecast();
		container.querySelectorAll("[data-forecast]").forEach(el => {
			el.value = forecast[el.dataset.forecast] || "";
		});
	}

	// =========================================================================
	// 2. Encounter Builder
	// =========================================================================
	_renderEncounterSection () {
		const section = this._makeSection("Encounters", true);
		const content = section.querySelector(".wt-section__content");

		// Add encounter button
		const addBtn = document.createElement("button");
		addBtn.className = "wt-btn wt-btn--small";
		addBtn.textContent = "+ Add Encounter";
		addBtn.addEventListener("click", () => {
			this._state.addEncounter({
				name: "",
				monsters: [],
				partySize: 4,
				partyLevel: this._state.getCharacter().level || 1,
			});
		});
		content.appendChild(addBtn);

		const listContainer = document.createElement("div");
		listContainer.className = "wt-encounter-list";
		listContainer.dataset.encounterList = "";
		content.appendChild(listContainer);

		this._updateEncounterDisplay(content);
		return section;
	}

	_updateEncounterDisplay (container) {
		const root = container || this._$wrpEncounters?.querySelector(".wt-section__content");
		if (!root) return;

		const listEl = root.querySelector("[data-encounter-list]");
		if (!listEl) return;

		const encounters = this._state.getEncounters();

		if (encounters.length === 0) {
			listEl.innerHTML = `<div class="wt-prepared__empty">No encounters planned. Click "+ Add Encounter" to begin.</div>`;
			return;
		}

		listEl.innerHTML = encounters.map((enc, idx) => {
			const monsterRows = (enc.monsters || []).map((mon, mIdx) => `
				<div class="wt-encounter__monster-row" data-enc-id="${this._escAttr(enc.id)}" data-monster-idx="${mIdx}">
					<input class="wt-encounter__monster-name" type="text"
						value="${this._escAttr(mon.name)}" placeholder="Monster name"
						data-monster-field="name">
					<input class="wt-encounter__monster-count" type="number" min="1" max="99"
						value="${mon.count || 1}" placeholder="#"
						data-monster-field="count">
					<button class="wt-encounter__monster-remove" data-remove-monster
						title="Remove monster">&times;</button>
				</div>
			`).join("");

			return `
				<div class="wt-encounter" data-enc-id="${this._escAttr(enc.id)}">
					<div class="wt-encounter__header">
						<input class="wt-encounter__name" type="text"
							value="${this._escAttr(enc.name || `Encounter ${idx + 1}`)}"
							placeholder="Encounter name"
							data-enc-name="${this._escAttr(enc.id)}">
						<button class="wt-encounter__remove" data-remove-enc="${this._escAttr(enc.id)}"
							title="Remove encounter">&times;</button>
					</div>
					<div class="wt-encounter__party-config">
						<label class="wt-forecast__label">Party Size</label>
						<input type="number" min="1" max="12" value="${enc.partySize || 4}"
							data-enc-party-size="${this._escAttr(enc.id)}">
						<label class="wt-forecast__label">Party Level</label>
						<input type="number" min="1" max="20" value="${enc.partyLevel || 1}"
							data-enc-party-level="${this._escAttr(enc.id)}">
					</div>
					<div class="wt-encounter__monsters" data-enc-monsters="${this._escAttr(enc.id)}">
						${monsterRows}
					</div>
					<button class="wt-btn wt-btn--small" data-add-monster="${this._escAttr(enc.id)}">+ Add Monster</button>
				</div>
			`;
		}).join("");

		this._bindEncounterEvents(listEl);
	}

	_bindEncounterEvents (listEl) {
		// Remove encounter
		listEl.querySelectorAll("[data-remove-enc]").forEach(btn => {
			btn.addEventListener("click", () => {
				this._state.removeEncounter(btn.dataset.removeEnc);
			});
		});

		// Encounter name change
		listEl.querySelectorAll("[data-enc-name]").forEach(input => {
			input.addEventListener("change", () => {
				this._state.updateEncounter(input.dataset.encName, {name: input.value});
			});
		});

		// Party size change
		listEl.querySelectorAll("[data-enc-party-size]").forEach(input => {
			input.addEventListener("change", () => {
				this._state.updateEncounter(input.dataset.encPartySize, {
					partySize: parseInt(input.value, 10) || 4,
				});
			});
		});

		// Party level change
		listEl.querySelectorAll("[data-enc-party-level]").forEach(input => {
			input.addEventListener("change", () => {
				this._state.updateEncounter(input.dataset.encPartyLevel, {
					partyLevel: parseInt(input.value, 10) || 1,
				});
			});
		});

		// Add monster
		listEl.querySelectorAll("[data-add-monster]").forEach(btn => {
			btn.addEventListener("click", () => {
				const encId = btn.dataset.addMonster;
				const enc = this._state.getEncounters().find(e => e.id === encId);
				if (!enc) return;
				const monsters = [...(enc.monsters || []), {name: "", count: 1}];
				this._state.updateEncounter(encId, {monsters});
			});
		});

		// Remove monster
		listEl.querySelectorAll("[data-remove-monster]").forEach(btn => {
			btn.addEventListener("click", () => {
				const row = btn.closest(".wt-encounter__monster-row");
				const encId = row.dataset.encId;
				const mIdx = parseInt(row.dataset.monsterIdx, 10);
				const enc = this._state.getEncounters().find(e => e.id === encId);
				if (!enc) return;
				const monsters = [...enc.monsters];
				monsters.splice(mIdx, 1);
				this._state.updateEncounter(encId, {monsters});
			});
		});

		// Monster field changes (name and count)
		listEl.querySelectorAll("[data-monster-field]").forEach(input => {
			input.addEventListener("change", () => {
				const row = input.closest(".wt-encounter__monster-row");
				const encId = row.dataset.encId;
				const mIdx = parseInt(row.dataset.monsterIdx, 10);
				const field = input.dataset.monsterField;
				const enc = this._state.getEncounters().find(e => e.id === encId);
				if (!enc) return;

				const monsters = enc.monsters.map((m, i) => {
					if (i !== mIdx) return {...m};
					return {
						...m,
						[field]: field === "count" ? (parseInt(input.value, 10) || 1) : input.value,
					};
				});
				this._state.updateEncounter(encId, {monsters});
			});
		});
	}

	// =========================================================================
	// 3. Slot Expenditure Estimate
	// =========================================================================
	_renderAttritionSection () {
		const section = this._makeSection("Slot Expenditure Estimate", true);
		const content = section.querySelector(".wt-section__content");

		const attritionWrp = document.createElement("div");
		attritionWrp.className = "wt-attrition";
		attritionWrp.dataset.attritionContainer = "";
		content.appendChild(attritionWrp);

		this._updateAttritionDisplay(content);
		return section;
	}

	_updateAttritionDisplay (container) {
		const root = container || this._$wrpAttrition?.querySelector(".wt-section__content");
		if (!root) return;

		const el = root.querySelector("[data-attrition-container]");
		if (!el) return;

		const slots = this._state.getSpellSlots();
		const forecast = this._state.getForecast();
		const encounters = this._state.getEncounters();
		const totalMax = slots.max.reduce((s, v) => s + v, 0);

		if (totalMax === 0) {
			el.innerHTML = `<div class="wt-prepared__empty">No spell slots available at this level.</div>`;
			return;
		}

		const encounterCount = encounters.length > 0
			? encounters.length
			: this._getEstimatedEncounterCount(forecast);

		const intensity = forecast.combatIntensity || "moderate";
		const rest = forecast.restAvailability || "longRest";
		const ratePerEncounter = (WarTableForecast.EXPENDITURE_RATES[intensity] || WarTableForecast.EXPENDITURE_RATES.moderate)[rest] || 0.25;

		// Compute projected slot state after each encounter
		const projections = this._computeSlotProjections(slots.max, encounterCount, ratePerEncounter, rest);

		// Overall expenditure band
		const totalExpended = projections.length > 0
			? projections[projections.length - 1].totalExpended
			: 0;
		const expendPct = totalMax > 0 ? totalExpended / totalMax : 0;
		const band = WarTableForecast.EXPENDITURE_BANDS.find(b => expendPct <= b.max)
			|| WarTableForecast.EXPENDITURE_BANDS[WarTableForecast.EXPENDITURE_BANDS.length - 1];

		const isEstimated = encounters.length === 0;

		let html = `
			<div class="wt-slot-band ${band.className}">
				<span class="wt-slot-band__label">Projected expenditure: <strong>${band.label}</strong></span>
				<span class="wt-slot-band__detail">${Math.round(expendPct * 100)}% of total slots over ${encounterCount} encounter${encounterCount !== 1 ? "s" : ""}${isEstimated ? " (estimated)" : ""}</span>
			</div>
		`;

		// Attrition view: one block per encounter showing projected pip state
		html += `<div class="wt-attrition__timeline">`;

		// Starting state
		html += this._renderSlotPipsBlock("Start", slots.max, 0);

		for (let i = 0; i < projections.length; i++) {
			const proj = projections[i];
			const encLabel = encounters.length > 0 && encounters[i]
				? (encounters[i].name || `Encounter ${i + 1}`)
				: `Encounter ${i + 1}`;

			// Check for short rest recovery between encounters
			const restLabel = proj.restRecovered > 0 ? ` (+${proj.restRecovered} rest)` : "";

			html += this._renderSlotPipsBlock(
				`After ${this._escHtml(encLabel)}${restLabel}`,
				slots.max,
				proj.totalExpended,
			);
		}

		html += `</div>`;

		el.innerHTML = html;
	}

	/**
	 * Compute projected slot state after each encounter.
	 * Drains slots from lowest level first (most common expenditure pattern).
	 */
	_computeSlotProjections (maxSlots, encounterCount, ratePerEncounter, rest) {
		const projections = [];
		const totalMax = maxSlots.reduce((s, v) => s + v, 0);
		let cumulativeExpended = 0;

		for (let i = 0; i < encounterCount; i++) {
			let slotsToSpend = Math.max(1, Math.round(totalMax * ratePerEncounter));

			// Clamp so we don't over-spend
			slotsToSpend = Math.min(slotsToSpend, totalMax - cumulativeExpended);
			cumulativeExpended += slotsToSpend;

			let restRecovered = 0;

			// Short rest recovery between encounters (not after the last one)
			if (rest === "shortRests" && i < encounterCount - 1) {
				// Rough estimate: recover ~2 low-level slots on a short rest (Warlock pact slots, Arcane Recovery, etc.)
				const recoverable = Math.min(2, cumulativeExpended);
				cumulativeExpended -= recoverable;
				restRecovered = recoverable;
			}

			projections.push({
				encounterIndex: i,
				slotsSpent: slotsToSpend,
				restRecovered,
				totalExpended: cumulativeExpended,
				totalRemaining: totalMax - cumulativeExpended,
			});
		}

		return projections;
	}

	/**
	 * Render a mini-pip block showing total slot state at a point in time.
	 * Shows pips for each slot level with filled/expended state.
	 */
	_renderSlotPipsBlock (label, maxSlots, totalExpended) {
		const totalMax = maxSlots.reduce((s, v) => s + v, 0);
		const remaining = Math.max(0, totalMax - totalExpended);

		// Distribute remaining slots: fill from highest level first
		// (players tend to preserve high-level slots and spend low-level first)
		let distributed = 0;
		const slotState = maxSlots.map(() => 0);

		// Fill from top down
		for (let lvl = 8; lvl >= 0; lvl--) {
			if (maxSlots[lvl] === 0) continue;
			const canFill = Math.min(maxSlots[lvl], remaining - distributed);
			slotState[lvl] = canFill;
			distributed += canFill;
			if (distributed >= remaining) break;
		}

		let pipsHtml = "";
		for (let lvl = 0; lvl < 9; lvl++) {
			if (maxSlots[lvl] === 0) continue;

			const pips = [];
			for (let p = 0; p < maxSlots[lvl]; p++) {
				const isFilled = p < slotState[lvl];
				const pipClass = isFilled ? "wt-attrition__mini-pip--filled" : "wt-attrition__mini-pip--expended";
				pips.push(`<span class="wt-attrition__mini-pip ${pipClass}" title="Level ${lvl + 1} slot"></span>`);
			}
			pipsHtml += `<span class="wt-attrition__mini-pip-group" data-level="${lvl + 1}">${pips.join("")}</span>`;
		}

		return `
			<div class="wt-attrition__encounter">
				<div class="wt-attrition__encounter-label">${label}</div>
				<div class="wt-attrition__slots-preview">${pipsHtml}</div>
				<div class="wt-attrition__count">${remaining}/${totalMax}</div>
			</div>
		`;
	}

	/**
	 * Estimate number of encounters when none are explicitly defined.
	 */
	_getEstimatedEncounterCount (forecast) {
		switch (forecast.encounterScale) {
			case "single": return 1;
			case "multiple": return forecast.combatIntensity === "heavy" ? 4 : 3;
			case "unknown":
			default:
				switch (forecast.combatIntensity) {
					case "light": return 1;
					case "heavy": return 4;
					case "moderate":
					default: return 2;
				}
		}
	}

	// =========================================================================
	// 4. Action Economy Snapshot
	// =========================================================================
	_renderActionEconomySection () {
		const section = this._makeSection("Action Economy", false);
		const content = section.querySelector(".wt-section__content");

		const aeWrp = document.createElement("div");
		aeWrp.className = "wt-action-economy";
		aeWrp.dataset.actionEconomyContainer = "";
		content.appendChild(aeWrp);

		this._updateActionEconomyDisplay(content);
		return section;
	}

	_updateActionEconomyDisplay (container) {
		const root = container || this._$wrpActionEconomy?.querySelector(".wt-section__content");
		if (!root) return;

		const el = root.querySelector("[data-action-economy-container]");
		if (!el) return;

		const encounters = this._state.getEncounters();

		if (encounters.length === 0) {
			el.innerHTML = `<div class="wt-prepared__empty">Add encounters to see action economy analysis.</div>`;
			return;
		}

		el.innerHTML = encounters.map((enc, idx) => {
			const partySize = enc.partySize || 4;
			const totalMonsters = (enc.monsters || []).reduce((sum, m) => sum + (m.count || 1), 0);

			// Party actions per round: each PC gets 1 action, 1 bonus action, 1 reaction
			// For simplicity, count "actions" as the primary action economy unit
			const partyActions = partySize;
			const monsterActions = totalMonsters;
			const ratio = monsterActions > 0 ? (partyActions / monsterActions).toFixed(1) : "\u2014";

			let assessment = "";
			let assessClass = "";

			if (totalMonsters === 0) {
				assessment = "No monsters defined";
				assessClass = "wt-action-economy__assess--neutral";
			} else if (partyActions >= monsterActions * 2) {
				assessment = "Party heavily favored";
				assessClass = "wt-action-economy__assess--favorable";
			} else if (partyActions > monsterActions) {
				assessment = "Party advantage";
				assessClass = "wt-action-economy__assess--favorable";
			} else if (partyActions === monsterActions) {
				assessment = "Even";
				assessClass = "wt-action-economy__assess--neutral";
			} else if (monsterActions >= partyActions * 2) {
				assessment = "Party heavily outnumbered";
				assessClass = "wt-action-economy__assess--dangerous";
			} else {
				assessment = "Monster advantage";
				assessClass = "wt-action-economy__assess--unfavorable";
			}

			const encName = enc.name || `Encounter ${idx + 1}`;

			return `
				<div class="wt-action-economy__encounter">
					<div class="wt-action-economy__title">${this._escHtml(encName)}</div>
					<div class="wt-action-economy__comparison">
						<div class="wt-action-economy__side wt-action-economy__side--party">
							<span class="wt-action-economy__side-label">Party</span>
							<span class="wt-action-economy__side-count">${partyActions} action${partyActions !== 1 ? "s" : ""}/round</span>
						</div>
						<div class="wt-action-economy__vs">vs</div>
						<div class="wt-action-economy__side wt-action-economy__side--monsters">
							<span class="wt-action-economy__side-label">Monsters</span>
							<span class="wt-action-economy__side-count">${monsterActions} action${monsterActions !== 1 ? "s" : ""}/round</span>
						</div>
					</div>
					<div class="wt-action-economy__ratio">Ratio: ${ratio} : 1</div>
					<div class="wt-action-economy__assess ${assessClass}">${assessment}</div>
				</div>
			`;
		}).join("");
	}

	// =========================================================================
	// Utility: collapsible section
	// =========================================================================
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

	// =========================================================================
	// Utility: select option builder
	// =========================================================================
	_buildOptions (optionMap, selectedValue) {
		return Object.entries(optionMap).map(([value, label]) =>
			`<option value="${this._escAttr(value)}" ${value === selectedValue ? "selected" : ""}>${this._escHtml(label)}</option>`,
		).join("");
	}

	// =========================================================================
	// HTML escaping
	// =========================================================================
	_escHtml (str) {
		const div = document.createElement("div");
		div.textContent = str ?? "";
		return div.innerHTML;
	}

	_escAttr (str) {
		return (str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
};
