import { expect, test } from "@playwright/test";

test.describe("学员端骨架冒烟", () => {
  test("首页显示“学员端”", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "学员端" })).toBeVisible();
  });

  test("前端路由的深链接回到学员端骨架", async ({ page }) => {
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "学员端" })).toBeVisible();
  });

  test("/api 下的未知地址返回 JSON 404", async ({ request }) => {
    const res = await request.get("/api/does-not-exist");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ code: "COMMON_NOT_FOUND", message_key: "error.common.not_found", details: {} });
  });
});
