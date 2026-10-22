// S03 时间与资料的示例接口：全部业务数字来自页面 fixture，不在页面重算。
// 加载、出错、离线由 mocks/api.ts 统一制造；这里提供空、受限与数据不足的数据变体。
import type { S03SetupProfile } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S03/*.json", { eager: true, import: "default" });
type Mode = S03SetupProfile["state"];
// 时间单位换算常量，不是业务阈值。
const DAYS_PER_WEEK = 7;

function profile(ctx: MockContext, mode: Mode): S03SetupProfile {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (hit === undefined) throw new Error(`S03 缺少演示考试资料：${ctx.exam.examId}`);
  const data = structuredClone(hit[1] as S03SetupProfile);
  data.exam_name = ctx.exam.profile.name;
  data.state = mode;
  data.summary.calibration_days = param("plan.calibrate.weeks") * DAYS_PER_WEEK;
  if (mode === "empty") {
    data.materials = [];
    data.maps = [];
    data.unavailable_days = [];
  }
  if (mode === "insufficient_data") {
    data.calibration = { ...data.calibration, status: "collecting", observed_minutes: 0, sample_minutes: 0 };
  }
  return data;
}

export const routes = [
  defineRoute("getSetupProfile", (ctx) => profile(ctx, "normal"), {
    variants: {
      empty: (ctx) => profile(ctx, "empty"),
      restricted: (ctx) => profile(ctx, "restricted"),
      insufficient_data: (ctx) => profile(ctx, "insufficient_data"),
    },
  }),
];
