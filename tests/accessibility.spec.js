import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("login and all workspace screens pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Email address").fill("admin@ems.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-test-password-42");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
  for (const screen of ["Overview", "Tasks", "Team", "Activity", "Settings"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: new RegExp(screen) })
      .click();
    await page.screenshot({
      path: `test-results/${screen.toLowerCase()}-desktop.png`,
      fullPage: true,
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Overview" })
    .click();
  await page.getByRole("button", { name: "Create task" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of ["Tasks", "Team", "Activity", "Settings"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: new RegExp(screen) })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/${screen.toLowerCase()}-mobile.png`,
      fullPage: true,
    });
  }
});
