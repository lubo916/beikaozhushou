// U11：资料页只读示例。业务计数、双进度与审核评分由页面 fixture 提供，界面不重算。
// feat:S11-01 feat:S11-06 feat:S11-08 feat:S11-12
import type { S11Workspace } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { defineRoute, type MockContext } from "../route.ts";

type Availability = S11Workspace["availability"];
const FILES = import.meta.glob<S11Workspace>("../../../../../fixtures/pages/S11/*.json", {
  eager: true,
  import: "default",
});

function workspace(ctx: MockContext, availability: Availability): S11Workspace {
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new ApiError("COMMON_NOT_FOUND", { exam_id: ctx.exam.examId });
  const result = { ...fixture, availability };
  if (availability === "empty") {
    return {
      ...result,
      materials: [],
      alignments: [],
      health: [],
      inbox: [],
      templates: [],
      summary: {
        ...fixture.summary,
        coverage: 0,
        pending: 0,
        inbox_count: 0,
        storage_used_mb: 0,
      },
    };
  }
  if (availability === "restricted") {
    return {
      ...result,
      summary: { ...fixture.summary, parse_remaining: 0 },
    };
  }
  return result;
}

export const routes = [
  defineRoute("getS11MaterialsWorkspace", (ctx) => workspace(ctx, "normal"), {
    variants: {
      empty: (ctx) => workspace(ctx, "empty"),
      restricted: (ctx) => workspace(ctx, "restricted"),
      insufficient_data: (ctx) => workspace(ctx, "insufficient_data"),
    },
  }),
];
