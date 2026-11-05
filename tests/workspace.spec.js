import { test, expect } from "@playwright/test";
async function login(page, email = "admin@ems.local") {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-test-password-42");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
}
test("admin assigns a task and employee accepts and completes it", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Task title").fill("End to end acceptance task");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Confirm the complete employee task workflow.");
  await page.getByLabel("Assign to").selectOption({ label: "Jamie Chen" });
  await page.getByLabel("Due date").fill("2027-01-15");
  await page.getByLabel("Category").fill("QA");
  await page.getByRole("button", { name: "Assign task", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .first()
    .click();
  await login(page, "jamie@ems.local");
  await expect(
    page.getByRole("button", { name: "Team", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Tasks/ }).first().click();
  await page
    .getByRole("button", { name: "End to end acceptance task", exact: true })
    .click();
  await page.getByRole("button", { name: "Accept task", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "End to end acceptance task", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "End to end acceptance task" }),
  ).toContainText("Completed");
  await page.reload();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
});
test("team creation, search, board, CSV and deletion confirmation work", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: /Add employee/ }).click();
  await page.getByLabel("Full name").fill("Casey Test");
  await page.getByLabel("Email address").fill("casey@example.com");
  await page.getByLabel("Department", { exact: true }).fill("QA");
  await page
    .getByLabel("Temporary password")
    .fill("Temporary-test-password-42");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add employee", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Casey Test" })).toBeVisible();
  await page.getByRole("button", { name: /Tasks/ }).first().click();
  await page.getByLabel("Search tasks").fill("keyboard");
  await expect(
    page.getByRole("button", {
      name: "Audit keyboard navigation",
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("ems-tasks.csv");
  await page.getByRole("button", { name: "Board view" }).click();
  await expect(
    page.getByRole("button").filter({
      has: page.getByRole("heading", { name: "Audit keyboard navigation" }),
    }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Audit keyboard navigation" })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(
    page.getByText("This cannot be undone.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep task" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("responsive screens stay inside viewport and dialogs support keyboard", async ({
  page,
}) => {
  await login(page);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/overview-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByLabel("Task title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Current password")).toBeVisible();
});
