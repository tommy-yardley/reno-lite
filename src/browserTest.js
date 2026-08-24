const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitFor(selector, timeout = 5000) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await wait(25);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

function buttonNamed(name) {
  return [...document.querySelectorAll("button")].find(
    (button) =>
      button.textContent.trim() === name ||
      button.getAttribute("aria-label") === name ||
      button.getAttribute("title") === name,
  );
}

async function clickNamed(name) {
  const started = performance.now();
  while (performance.now() - started < 5000) {
    const button = buttonNamed(name);
    if (button) {
      button.click();
      await wait(60);
      return button;
    }
    await wait(25);
  }
  throw new Error(`Could not find button "${name}"`);
}

function worldPoint(svg, x, y) {
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  return point.matrixTransform(svg.getScreenCTM());
}

async function drawPoint(svg, x, y, pointerId) {
  const client = worldPoint(svg, x, y);
  svg.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: client.x,
      clientY: client.y,
      pointerId,
      pointerType: "mouse",
    }),
  );
  svg.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      clientX: client.x,
      clientY: client.y,
      pointerId,
      pointerType: "mouse",
    }),
  );
  await wait(80);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function report(status, message) {
  const output = document.createElement("pre");
  output.id = "browser-test-result";
  output.dataset.status = status;
  output.textContent = message;
  document.body.append(output);
}

export async function runBrowserTest() {
  try {
    await waitFor('svg[aria-label="CAD drawing canvas"]');
    const stage = sessionStorage.getItem("reno-lite:browser-test-stage");

    if (!stage) {
      const svg = document.querySelector('svg[aria-label="CAD drawing canvas"]');
      await drawPoint(svg, 150, 120, 1);
      await drawPoint(svg, 430, 120, 2);
      await drawPoint(svg, 430, 330, 3);
      await drawPoint(svg, 150, 330, 4);
      await drawPoint(svg, 150, 120, 5);
      assert(document.body.textContent.includes("Room 1"), "Closing four walls did not create a room face");

      const proposed = buttonNamed("Proposed");
      if (proposed) proposed.click();
      else {
        const view = document.querySelector('select[aria-label="Renovation view"]');
        view.value = "proposed";
        view.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await clickNamed("Furnish");
      await clickNamed("3-seat sofa");
      await drawPoint(svg, 280, 220, 6);
      assert(document.body.textContent.includes("3-seat sofa"), "Furniture placement did not render");

      await clickNamed("Open project library");
      await clickNamed("Save current");
      assert(document.querySelector('[role="status"]')?.textContent.includes("saved"), "Project library did not save");
      await clickNamed("Close project library");

      await wait(800);
      const saved = JSON.parse(localStorage.getItem("reno-lite:cad-v2"));
      assert(saved?.walls?.length === 4, "Autosave did not persist four walls");
      assert(saved?.objects?.some((object) => object.kind === "sofa"), "Autosave did not persist furniture");
      sessionStorage.setItem("reno-lite:browser-test-stage", "reload");
      location.reload();
      return;
    }

    assert(document.body.textContent.includes("Room 1"), "Room was not restored after reload");
    assert(document.body.textContent.includes("3-seat sofa"), "Furniture was not restored after reload");
    const unnamedButtons = [...document.querySelectorAll("button")].filter(
      (button) =>
        !button.textContent.trim() &&
        !button.getAttribute("aria-label") &&
        !button.getAttribute("title"),
    );
    assert(unnamedButtons.length === 0, `${unnamedButtons.length} icon buttons have no accessible name`);
    assert(document.querySelector("nav[aria-label]"), "Workspace tab navigation has no accessible name");
    assert(
      document.documentElement.scrollWidth <= window.innerWidth + 1,
      "Workspace creates horizontal page scrolling",
    );
    assert(
      document.documentElement.scrollHeight <= window.innerHeight + 1,
      "Workspace creates vertical page scrolling",
    );

    await clickNamed("Open reference plan");
    const referenceDialog = await waitFor('[role="dialog"][aria-label="Reference plan"]');
    assert(referenceDialog.getAttribute("aria-modal") === "true", "Reference panel is not modal");
    await clickNamed("Close");
    sessionStorage.removeItem("reno-lite:browser-test-stage");
    report("passed", "RenoLite browser interaction, persistence, responsive-shell and accessibility smoke checks passed.");
  } catch (error) {
    report("failed", error.stack || error.message);
  }
}
