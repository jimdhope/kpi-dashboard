/**
 * Represents a Key Performance Indicator (KPI) with its target and current achievement.
 */
export interface KPI {
  /**
   * The name or identifier of the KPI.
   */
  name: string;
  /**
   * The target value for the KPI.
   */
  target: number;
  /**
   * The current achievement value for the KPI.
   */
  achievement: number;
}

/**
 * Represents a campaign, pod, or team.
 */
export interface Group {
  /**
   * The unique identifier of the group.
   */
  id: string;
  /**
   * The name of the group.
   */
  name: string;
}

/**
 * Asynchronously retrieves KPIs for a given group.
 *
 * @param group The group for which to retrieve KPIs.
 * @returns A promise that resolves to an array of KPI objects.
 */
export async function getKPIs(group: Group): Promise<KPI[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      name: 'Sales',
      target: 1000000,
      achievement: 750000,
    },
    {
      name: 'Customer Acquisition',
      target: 1000,
      achievement: 800,
    },
  ];
}
