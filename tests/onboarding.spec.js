import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const password = "Onboarding-browser-test-42";
test("signup resumes unfinished setup, validates a workspace URL, and opens an isolated workspace", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Room for good work." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/signup-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Your full name").fill("Taylor Owner");
  await page.getByLabel("Email address").fill("browser-owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "First, a proper introduction." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "First, a proper introduction." }),
  ).toBeVisible();
  await page.getByLabel("Department").fill("Product");
  await page.getByRole("button", { name: "Continue", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "A home for your team." }),
  ).toBeVisible();
  await page.getByLabel("Workspace name").fill("Northstar Browser");
  await page.getByLabel("Workspace address").fill("workplace");
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(page.getByRole("alert")).toContainText("taken");
  await page.getByLabel("Workspace address").fill("northstar-browser");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/setup-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/setup-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
  await expect(page.getByText("No tasks here yet.")).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Team", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Taylor Owner", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Jamie Chen", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .first()
    .click();
  await page.getByLabel("Email address").fill("browser-owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
});
test("signup handles mismatched passwords, duplicate email and returning to login", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Your full name").fill("Someone");
  await page.getByLabel("Email address").fill("admin@ems.local");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill("A-different-password-42");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("do not match");
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("already");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
