// S21：简版只读示例，不录音、不保存媒体、不追加真实口述证据。
// 挂载结论和雷达可见性由接口给出；口试画像字段、样本阈值待后端任务接入公共配置。
import type { S21OralTrainingHome } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob<S21OralTrainingHome>("../../../../../fixtures/pages/S21/*.json", { eager: true, import: "default" });

function home(ctx: MockContext): S21OralTrainingHome {
  const entry = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (entry === undefined) throw new Error("S21 fixture missing");
  return structuredClone(entry[1]);
}

// 强制七态仅供开发查看，未开启考试也能预览各局部状态；正常数据不受影响。
function preview(ctx: MockContext): S21OralTrainingHome {
  const data = home(ctx);
  return { ...data, activation: data.activation === "disabled" ? "manual" : data.activation };
}

export const routes = [
  defineRoute("getOralTrainingHome", home, {
    variants: {
      empty: (ctx) => {
        const data = preview(ctx);
        return {
          ...data,
          assessment: { ...data.assessment, available: false },
          radar: { ...data.radar, sufficient: false, sample_count: 0, dimensions: [] },
        };
      },
      restricted: (ctx) => ({ ...preview(ctx), video_analysis_allowed: false }),
      insufficient_data: (ctx) => {
        const data = preview(ctx);
        return { ...data, radar: { ...data.radar, sufficient: false, sample_count: 1, dimensions: [] } };
      },
    },
  }),
];
