export type TxType = "expense" | "income";

export type Account = { id: string; name: string };
export type Category = { id: string; name: string; type: TxType };
export type Project = { id: string; name: string };
export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  category_id: string;
  account_id: string;
  project_id: string | null;
  note: string;
  date: string;
  recurring_id?: string | null;
};
export type RecurringItem = {
  id: string;
  name: string;
  type: TxType;
  amount: number;
  category_id: string;
  account_id: string;
  project_id: string | null;
  day_of_month: number;
  active: boolean;
};
export type AppData = {
  accounts: Account[];
  categories: Category[];
  projects: Project[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  monthlyBudget: number;
};
