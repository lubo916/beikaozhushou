// 假数据（platform）：全部登记参数的当前取值（经参数访问器）。
import { defineRoute } from "../route.ts";

export const routes = [defineRoute("getParams", ({ db }) => db.params())];
