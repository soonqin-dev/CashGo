import { AppData } from "./types";

const id = (name: string) => `local-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export const DEFAULT_DATA: AppData = {
  monthlyBudget: 1500,
  accounts: [
    { id: id("Cash"), name: "Cash" },
    { id: id("Maybank"), name: "Maybank" },
    { id: id("TNG eWallet"), name: "TNG eWallet" }
  ],
  categories: [
    { id: id("expense-food"), name: "餐饮", type: "expense" },
    { id: id("expense-transport"), name: "交通", type: "expense" },
    { id: id("expense-shopping"), name: "购物", type: "expense" },
    { id: id("expense-bills"), name: "账单", type: "expense" },
    { id: id("expense-other"), name: "其他", type: "expense" },
    { id: id("income-salary"), name: "薪资", type: "income" },
    { id: id("income-commission"), name: "佣金", type: "income" },
    { id: id("income-freelance"), name: "自由职业", type: "income" },
    { id: id("income-other"), name: "其他", type: "income" }
  ],
  projects: [
    { id: id("Coway"), name: "Coway" },
    { id: id("Renovation"), name: "Renovation" },
    { id: id("Freelance"), name: "Freelance" },
    { id: id("Music"), name: "Music" }
  ],
  transactions: [],
  recurring: []
};
