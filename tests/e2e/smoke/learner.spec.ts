import { expect, test } from "@playwright/test";

test.describe("学员端外壳冒烟", () => {
  test("首页跳到外壳里的今日页", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { level: 1, name: "今日" })).toBeVisible();
  });

  test("前端路由的深链接回到学员端外壳", async ({ page }) => {
    await page.goto("/mistakes");
    await expect(page.getByRole("heading", { level: 1, name: "错题本" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  });

  test("/api 下的未知地址返回 JSON 404", async ({ request }) => {
    const res = await request.get("/api/does-not-exist");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ code: "COMMON_NOT_FOUND", message_key: "error.common.not_found", details: {} });
  });
});
