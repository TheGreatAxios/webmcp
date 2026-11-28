import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  cleanupPolyfill,
  experimental_buildFormInputSchema,
  experimental_enableDeclarativeForms,
  installPolyfill,
  type DeclarativeSubmitEvent,
} from "../index";

let happyWin: Window;

beforeEach(() => {
  cleanupPolyfill();
  installPolyfill();
  happyWin = new Window({ url: "https://shop.example/" });
});

afterEach(() => {
  happyWin.close();
  cleanupPolyfill();
});

describe("experimental declarative HTML forms", () => {
  test("synthesizes JSON Schema from form controls while excluding hidden inputs", () => {
    happyWin.document.body.innerHTML = `
      <form toolname="reserve_table" tooldescription="Reserve a dinner table" toolautosubmit>
        <input type="hidden" name="csrf_token" value="secret-123" />
        <label for="guest">Guest Name</label>
        <input id="guest" type="text" name="guest" required />
        <input type="number" name="partySize" toolparamdescription="Number of guests" required />
        <input type="checkbox" name="patio" toolparamdescription="Prefer outdoor patio" />
        <select name="timeSlot" required>
          <option value="18:00">6 PM</option>
          <option value="20:00">8 PM</option>
        </select>
        <button type="submit">Book</button>
      </form>
    `;
    const form = happyWin.document.querySelector("form") as unknown as HTMLFormElement;
    const schema = experimental_buildFormInputSchema(form);

    expect(schema).toEqual({
      type: "object",
      properties: {
        guest: { type: "string", description: "Guest Name" },
        partySize: { type: "number", description: "Number of guests" },
        patio: { type: "boolean", description: "Prefer outdoor patio" },
        timeSlot: { type: "string", enum: ["18:00", "20:00"] },
      },
      required: ["guest", "partySize", "timeSlot"],
    });
    expect((schema.properties as Record<string, unknown>).csrf_token).toBeUndefined();
  });

  test("registers <form toolname>, populates fields, and supports SubmitEvent.respondWith()", async () => {
    happyWin.document.body.innerHTML = `
      <form toolname="search_flights" tooldescription="Search available flights" toolautosubmit>
        <input type="text" name="origin" required />
        <input type="text" name="dest" required />
        <button type="submit">Search</button>
      </form>
    `;
    const form = happyWin.document.querySelector("form") as unknown as HTMLFormElement;
    let sawAgentInvoked = false;
    let activeDuringSubmit = false;

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const dEv = ev as unknown as DeclarativeSubmitEvent;
      sawAgentInvoked = dEv.agentInvoked === true;
      activeDuringSubmit = form.classList.contains("tool-form-active");
      const origin = (form.querySelector('input[name="origin"]') as HTMLInputElement).value;
      const dest = (form.querySelector('input[name="dest"]') as HTMLInputElement).value;
      dEv.respondWith({ route: `${origin}->${dest}`, flights: 3 });
    });

    const controller = experimental_enableDeclarativeForms({
      root: happyWin.document as unknown as ParentNode,
      doc: document,
    });

    const tools = await document.modelContext!.getTools();
    expect(tools.map((t) => t.name)).toEqual(["search_flights"]);

    const raw = await document.modelContext!.executeTool(tools[0], {
      origin: "SFO",
      dest: "JFK",
    });

    expect(JSON.parse(raw)).toEqual({ route: "SFO->JFK", flights: 3 });
    expect(sawAgentInvoked).toBe(true);
    expect(activeDuringSubmit).toBe(true);
    expect(form.classList.contains("tool-form-active")).toBe(false);

    controller.disconnect();
    expect(await document.modelContext!.getTools()).toHaveLength(0);
  });
});
