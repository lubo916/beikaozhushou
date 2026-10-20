// 假数据（learner）：掌握方格（示例值；掌握档规则落地前标 data_source: sample）。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("getMasteryGrid", ({ db, query }) => db.masteryGrid(query.get("mapId") ?? ""), {
    variants: {
      empty: ({ query }) => ({ map_id: query.get("mapId") ?? "", cells: [], data_source: "sample" }),
      insufficient_data: ({ db, query }) => {
        const grid = db.masteryGrid(query.get("mapId") ?? "");
        const cells = Array.isArray(grid["cells"]) ? grid["cells"] : [];
        return { ...grid, cells: cells.map((cell: unknown) => ({ ...(cell as object), evidence_sufficient: false })) };
      },
    },
  }),
];
