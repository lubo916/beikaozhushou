import { describe, expect, it } from "vitest";
import { handleO01, o01Fixture } from "../../mocks/pages/O01.ts";

describe("O01 聚合统计授权与样本保护", () => {
  for (const state of ["restricted", "insufficient_data"]) {
    it(`${state} 响应移除节省工时与周报结论，且不污染原始示例`, async () => {
      for (const exam of ["kj", "js", "en", "ds"]) {
        const before = o01Fixture(exam);
        const response = await handleO01({
          method: "GET",
          url: `http://localhost/api/v1/org/workbench?exam=${exam}&state=${state}`,
          headers: new Headers(),
          body: undefined,
        });
        expect(response.kind).toBe("json");
        if (response.kind !== "json") throw new Error("O01 应返回示例 JSON");
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ saving: [], weekly_summary: "" });
        expect(o01Fixture(exam)).toEqual(before);
      }
    });
  }

  it("正常授权且样本充足时保留接口提供的节省工时与周报", async () => {
    for (const exam of ["kj", "js", "en", "ds"]) {
      const fixture = o01Fixture(exam);
      expect(fixture.saving.length).toBeGreaterThan(0);
      expect(fixture.weekly_summary.length).toBeGreaterThan(0);
      const response = await handleO01({
        method: "GET",
        url: `http://localhost/api/v1/org/workbench?exam=${exam}&state=normal`,
        headers: new Headers(),
        body: undefined,
      });
      if (response.kind !== "json") throw new Error("O01 应返回示例 JSON");
      expect(response.body).toMatchObject({ saving: fixture.saving, weekly_summary: fixture.weekly_summary });
    }
  });
});
