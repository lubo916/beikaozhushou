import { expect, test } from "@playwright/test";

const API_PORT = process.env["E2E_API_PORT"] || "3100";

test.describe("工程骨架冒烟（F02）", () => {
  test("学员端占位页：标签页标题与页面上都是“备考助手”", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("备考助手");
    await expect(page.getByText("备考助手", { exact: true })).toBeVisible();
  });

  test("接口健康检查 /health 返回 ok", async ({ request }) => {
    const res = await request.get(`http://127.0.0.1:${API_PORT}/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });
});
