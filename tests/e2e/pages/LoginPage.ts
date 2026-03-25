import { expect, type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly heading: Locator;
  readonly signInButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Electricity MVP" });
    this.signInButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }
}

