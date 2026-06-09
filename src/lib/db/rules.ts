import { getSql } from "@/lib/db/client";
import type { BoqRuleRow, MeasurementStandard } from "@/lib/db/types";

export async function getRules({
  projectId,
  standard,
  scope
}: {
  projectId?: string;
  standard?: MeasurementStandard | "all";
  scope?: string;
}) {
  const sql = getSql();

  if (projectId) {
    const rows = (await sql`
      select r.*
      from boq_rules r
      join projects p on p.measurement_standard = r.measurement_standard
      where p.id = ${projectId}
      order by r.measurement_standard, r.scope, r.trade, r.item_type
    `) as BoqRuleRow[];
    return rows;
  }

  if (standard && standard !== "all" && scope) {
    const rows = (await sql`
      select *
      from boq_rules
      where measurement_standard = ${standard} and scope ilike ${`%${scope}%`}
      order by trade, item_type
    `) as BoqRuleRow[];
    return rows;
  }

  if (standard && standard !== "all") {
    const rows = (await sql`
      select *
      from boq_rules
      where measurement_standard = ${standard}
      order by scope, trade, item_type
    `) as BoqRuleRow[];
    return rows;
  }

  const rows = (await sql`
    select *
    from boq_rules
    order by measurement_standard, scope, trade, item_type
  `) as BoqRuleRow[];

  return rows;
}

export async function createRule({
  measurementStandard,
  scope,
  trade,
  itemType,
  unit,
  descriptionRule,
  inclusions,
  exclusions
}: {
  measurementStandard: MeasurementStandard;
  scope: string;
  trade: string;
  itemType: string;
  unit: string;
  descriptionRule: string;
  inclusions?: string | null;
  exclusions?: string | null;
}) {
  const sql = getSql();
  const rows = (await sql`
    insert into boq_rules (
      measurement_standard,
      scope,
      trade,
      item_type,
      unit,
      description_rule,
      inclusions,
      exclusions
    )
    values (
      ${measurementStandard},
      ${scope},
      ${trade},
      ${itemType},
      ${unit},
      ${descriptionRule},
      ${inclusions ?? null},
      ${exclusions ?? null}
    )
    returning *
  `) as BoqRuleRow[];

  return rows[0];
}

export async function deleteRule(ruleId: string) {
  const sql = getSql();

  await sql`
    delete from boq_rules
    where id = ${ruleId}
  `;
}
