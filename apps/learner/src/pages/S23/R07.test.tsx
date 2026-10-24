// R07 已定稿：R23/E28 禁止排名、百分位与参加人数；R22/E25/E26 规定可比较的卷型。
// 本文件验证页面只展示接口给出的成绩口径，不在页面重算目标差额或得分率。
import { describe, expect, it } from "vitest";
import type { S23AssessmentReport } from "@exam-prep/contract";
import { formatCount, formatDuration, formatPercent, formatScore } from "@exam-prep/shared/format";
import { mount } from "../../app/testing.tsx";
import { reportFixture } from "../../mocks/pages/S23.ts";
import { ReportHero } from "./components/ReportHero.tsx";

type AssessmentKind = "full" | "half" | "stage" | "custom";
type ScoreStatus = "official" | "provisional" | "incomplete";
interface TargetComparison {
  readonly target: number;
  readonly gap: number;
  readonly gap_kind: "above" | "below" | "on_target";
}
interface HeroScenario {
  readonly kind?: AssessmentKind;
  readonly status?: ScoreStatus;
  readonly comparison?: TargetComparison | null;
  readonly legacySampleCount?: number;
  readonly legacyRankVisible?: boolean;
  readonly score?: number;
  readonly total?: number;
  readonly scoreRate?: number;
}

/** 测试输入预先给定业务结果；旧排名字段故意保留以证明页面不会重新展示历史缓存中的排名。 */
function scenario(input: HeroScenario = {}): S23AssessmentReport {
  const report = reportFixture("junior-accounting");
  return Object.assign(report, {
    assessment_kind: input.kind ?? "full",
    score_status: input.status ?? "official",
    target_comparison: input.comparison === undefined ? { target: 70, gap: 8, gap_kind: "below" } : input.comparison,
    summary: Object.assign(report.summary, {
      score: input.score ?? 62,
      total: input.total ?? 100,
      score_rate: input.scoreRate ?? 0.62,
      sample_count: input.legacySampleCount ?? 1200,
      minimum_sample_count: 200,
      rank_visible: input.legacyRankVisible ?? true,
      percentile: 0.64,
    }),
  });
}

function expectNoRanking(host: HTMLElement): void {
  expect(host.textContent).not.toMatch(/百分位|排名|成绩位置|有效样本|当前有效样本/);
  expect(host.textContent).not.toMatch(/(?:1200|1,200|386|36)\s*人/);
}

describe("S23 R07 R23：无条件禁止群体成绩比较", () => {
  for (const example of [
    { label: "E28 同卷已有1200人且旧接口允许排名", count: 1200, visible: true },
    { label: "正常示例386人且旧接口允许排名", count: 386, visible: true },
    { label: "低样本36人且旧接口不允许排名", count: 36, visible: false },
  ]) {
    it(example.label + "：英雄区均无百分位与人数", async () => {
      const { host, unmount } = await mount(
        <ReportHero report={scenario({ legacySampleCount: example.count, legacyRankVisible: example.visible })} />,
      );
      try {
        expectNoRanking(host);
        expect(host.textContent).toContain(formatScore(62, { total: 100 }));
        expect(host.textContent).toContain(formatDuration(92));
        expect(host.textContent).toContain("切屏记录");
        expect(host.textContent).toContain(formatCount(2, "次"));
      } finally {
        await unmount();
      }
    });
  }

  it("没考完的数据不足由接口明确给出：保留本次原始得分、用时与切屏计数，不显示排名或目标比较", async () => {
    const { host, unmount } = await mount(
      <ReportHero report={scenario({ status: "incomplete", comparison: null, legacySampleCount: 36, legacyRankVisible: false })} />,
    );
    try {
      expect(host.textContent).toContain("这场没考完，没出正式分");
      expect(host.textContent).toContain(formatScore(62, { total: 100 }));
      expect(host.textContent).toContain(formatDuration(92));
      expect(host.textContent).toContain(formatCount(2, "次"));
      expect(host.textContent).not.toMatch(/目标线|距目标线|高于目标线|已到目标线/);
      expectNoRanking(host);
    } finally {
      await unmount();
    }
  });
});

describe("S23 R07 R22：目标比较完全采用接口口径", () => {
  for (const kind of ["stage", "custom"] as const) {
    it(kind + "：接口不提供目标比较时只显示得分和返回的得分率", async () => {
      const { host, unmount } = await mount(<ReportHero report={scenario({ kind, comparison: null, scoreRate: 0.62 })} />);
      try {
        expect(host.textContent).toContain(formatScore(62, { total: 100 }));
        expect(host.textContent).toContain(formatPercent(0.62));
        expect(host.textContent).not.toMatch(/目标线|距目标线|高于目标线|已到目标线/);
        expectNoRanking(host);
      } finally {
        await unmount();
      }
    });
  }

  it("正式完整模考展示接口返回的目标差额", async () => {
    const { host, unmount } = await mount(
      <ReportHero report={scenario({ kind: "full", comparison: { target: 70, gap: 8, gap_kind: "below" } })} />,
    );
    try {
      expect(host.textContent).toContain("目标线 " + formatScore(70));
      expect(host.textContent).toContain("距目标线还差 " + formatScore(8));
      expectNoRanking(host);
    } finally {
      await unmount();
    }
  });

  it("E25 正式半卷30/51：直接展示接口折算后的11.2分差额", async () => {
    const { host, unmount } = await mount(
      <ReportHero
        report={scenario({
          kind: "half",
          score: 30,
          total: 51,
          scoreRate: 0.588,
          comparison: { target: 70, gap: 11.2, gap_kind: "below" },
        })}
      />,
    );
    try {
      expect(host.textContent).toContain(formatScore(30, { total: 51 }));
      expect(host.textContent).toContain("距目标线还差 " + formatScore(11.2));
      expectNoRanking(host);
    } finally {
      await unmount();
    }
  });
});

describe("S23 本页假数据遵守R07口径", () => {
  it("四考试均明确卷型、成绩状态、可空目标比较和接口得分率，移除群体成绩字段", () => {
    for (const exam of ["junior-accounting", "teacher-qualification", "cet-6", "ds-final-custom"]) {
      const report = reportFixture(exam) as S23AssessmentReport & {
        assessment_kind?: AssessmentKind;
        score_status?: ScoreStatus;
        target_comparison?: TargetComparison | null;
        summary: S23AssessmentReport["summary"] & { score_rate?: number };
      };
      expect(["full", "half", "stage", "custom"]).toContain(report.assessment_kind);
      expect(["official", "provisional", "incomplete"]).toContain(report.score_status);
      expect(typeof report.summary.score_rate).toBe("number");
      expect(report.summary).not.toHaveProperty("rank_visible");
      expect(report.summary).not.toHaveProperty("percentile");
      expect(report.summary).not.toHaveProperty("sample_count");
      expect(report.summary).not.toHaveProperty("minimum_sample_count");
      if (report.assessment_kind === "stage" || report.assessment_kind === "custom" || report.score_status !== "official") {
        expect(report.target_comparison).toBeNull();
      }
    }
  });
});
