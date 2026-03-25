import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

test("GET /login: renders the login page (QA smoke)", async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.expectLoaded();
});

test("GET / (unauthenticated): redirects to /login (QA smoke)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  const login = new LoginPage(page);
  await login.expectLoaded();
});
