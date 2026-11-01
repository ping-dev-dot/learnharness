/**
 * enter-submits + focus-hygiene — the pointer/keyboard Enter split and the
 * transient-control blur (owner, keyboard round 2026-10-10).
 *
 * The regression this pins: clicking a transcript control (a thinking
 * toggle) left focus on its <button>; the learner's next Enter re-activated
 * the toggle instead of submitting. The law now: Enter from a
 * POINTER-focused transcript button submits (the window listener also
 * preventDefaults, suppressing the default activation underneath);
 * keyboard-focused buttons and buttons inside open overlays (menus walk
 * focus with arrows, dialogs are their own layer) keep native Enter.
 */
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { describe, it } from "node:test";
import { buttonKeepsNativeEnter, shouldEnterSubmit, isCoarsePointer } from "../components/enter-submits.ts";
import { blurAfterPointerClick } from "../components/focus-hygiene.ts";

const { document } = parseHTML("<html><body></body></html>");

function buttonIn(attrs: Record<string, string>): HTMLElement {
	const host = document.createElement("div");
	for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
	const b = document.createElement("button");
	b.type = "button";
	host.appendChild(b);
	document.body.appendChild(host);
	return b;
}

describe("buttonKeepsNativeEnter (the pointer/keyboard Enter split)", () => {
	it("a transcript button (pointer-focused) does NOT keep native Enter — Enter submits", () => {
		const b = buttonIn({});
		assert.equal(buttonKeepsNativeEnter(b), false);
	});

	it("a keyboard-focused button keeps native Enter (:focus-visible)", () => {
		const b = buttonIn({});
		// linkedom lacks the pseudo — stub the one call the helper makes.
		(b as unknown as { matches: (sel: string) => boolean }).matches = (sel: string) =>
			sel === ":focus-visible";
		assert.equal(buttonKeepsNativeEnter(b), true);
	});

	it("buttons inside overlays keep native Enter: hand-rolled menu, Radix popper, dialog, menu role", () => {
		assert.equal(buttonKeepsNativeEnter(buttonIn({ "data-lh-menu": "" })), true);
		assert.equal(
			buttonKeepsNativeEnter(buttonIn({ "data-radix-popper-content-wrapper": "" })),
			true,
		);
		assert.equal(buttonKeepsNativeEnter(buttonIn({ role: "dialog" })), true);
		assert.equal(buttonKeepsNativeEnter(buttonIn({ role: "menu" })), true);
	});

	it("a selector engine without :focus-visible degrades to pointer-focus, never throws", () => {
		const b = buttonIn({});
		assert.doesNotThrow(() => buttonKeepsNativeEnter(b));
		assert.equal(buttonKeepsNativeEnter(b), false);
	});
});

describe("blurAfterPointerClick (focus hygiene)", () => {
	it("a POINTER click (detail > 0) blurs the transient control", () => {
		const b = buttonIn({});
		let blurred = false;
		b.blur = () => {
			blurred = true;
		};
		blurAfterPointerClick({ detail: 1, currentTarget: b });
		assert.equal(blurred, true);
	});

	it("a KEYBOARD-activated click (detail 0) keeps focus", () => {
		const b = buttonIn({});
		let blurred = false;
		b.blur = () => {
			blurred = true;
		};
		blurAfterPointerClick({ detail: 0, currentTarget: b });
		assert.equal(blurred, false);
	});
});

describe("shouldEnterSubmit (pointer / modifier chord law)", () => {
	it("on desktop (coarse = false): plain Enter submits, Shift+Enter does not, Cmd/Ctrl+Enter submits", () => {
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: false, metaKey: false, ctrlKey: false }, false), true);
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: true, metaKey: false, ctrlKey: false }, false), false);
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: false, metaKey: true, ctrlKey: false }, false), true);
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: false, metaKey: false, ctrlKey: true }, false), true);
		assert.equal(shouldEnterSubmit({ key: "a", shiftKey: false, metaKey: false, ctrlKey: false }, false), false);
	});

	it("on touch screen (coarse = true): plain Enter inserts newline (does NOT submit), Cmd/Ctrl+Enter submits", () => {
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: false, metaKey: false, ctrlKey: false }, true), false);
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: true, metaKey: false, ctrlKey: false }, true), false);
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: false, metaKey: true, ctrlKey: false }, true), true);
		assert.equal(shouldEnterSubmit({ key: "Enter", shiftKey: false, metaKey: false, ctrlKey: true }, true), true);
	});

	it("isCoarsePointer returns false in SSR / test environments", () => {
		assert.equal(isCoarsePointer(), false);
	});
});
