import { expect, test } from "@playwright/test";
import { APP_NAMES, APP_URLS } from "../support/env.ts";

for (const app of ["learner", "org", "admin"] as const) {
  test(`${APP_NAMES[app]}声明可正常加载的站点图标`, async ({ page, request }) => {
    await page.goto(APP_URLS[app]);
    const icon = page.locator('link[rel~="icon"]').first();
    await expect(icon).toHaveAttribute("href", /\S+/);
    const href = await icon.getAttribute("href");
    if (!href) throw new Error("页面必须声明站点图标地址");
    const response = await request.get(new URL(href, page.url()).href);
    expect(response.status(), "声明的图标必须能实际加载").toBe(200);
    expect(response.headers()["content-type"], "图标必须使用图片 MIME 类型").toMatch(/^image\//);
    expect((await response.body()).byteLength, "图标资源必须有实际内容").toBeGreaterThan(0);
  });
}
